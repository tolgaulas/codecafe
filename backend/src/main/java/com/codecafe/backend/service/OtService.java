package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.util.OtUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Logger;
import java.util.logging.Level;

@Service
public class OtService {
    private static final Logger logger = Logger.getLogger(OtService.class.getName());
    private static final int MAX_HISTORY_SIZE_PER_DOC = 5000; // Max history size per session/document

    // Inner class to hold state for a single document within a session
    private static class DocumentState {
        String content = "";
        final List<TextOperation> operationHistory = new ArrayList<>();
        // Optional: Could add per-document lock here if needed later
    }

    // Map structure: Map<sessionId, Map<documentId, DocumentState>>
    private final Map<String, Map<String, DocumentState>> sessionDocuments = new ConcurrentHashMap<>();

    // Global lock for managing the sessionDocuments map structure safely (consider finer locks later)
    private final ReentrantLock serviceLock = new ReentrantLock();

    /**
     * Gets or creates the state for a given document ID within a specific session.
     * Must be called within a locked context (e.g., serviceLock).
     */
    private DocumentState getOrCreateDocumentState(String sessionId, String documentId) {
        // Get or create the inner map for the session
        Map<String, DocumentState> documentMap = sessionDocuments.computeIfAbsent(sessionId, k -> {
            logger.info(String.format("Creating new document map for session ID: %s", sessionId));
            return new ConcurrentHashMap<>();
        });
        // Get or create the DocumentState within the session's map
        return documentMap.computeIfAbsent(documentId, k -> {
            logger.info(String.format("[Session: %s] Creating new document state for ID: %s", sessionId, documentId));
            return new DocumentState();
        });
    }

    /**
     * Gets the current content for a specific document within a specific session.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @return The content of the document.
     */
    public String getDocumentContent(String sessionId, String documentId) {
        serviceLock.lock();
        try {
            DocumentState state = getOrCreateDocumentState(sessionId, documentId);
            return state.content;
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Gets the current server revision number for a specific document within a specific session.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @return The revision number for the document.
     */
    public int getRevision(String sessionId, String documentId) {
        serviceLock.lock();
        try {
            DocumentState state = getOrCreateDocumentState(sessionId, documentId);
            return state.operationHistory.size();
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Process an incoming operation from a client against a specified revision for a specific document within a specific session.
     * Transforms the operation against concurrent operations, applies it, and adds it to the history.
     *
     * @param sessionId      The identifier of the session.
     * @param documentId     The identifier of the document being modified.
     * @param clientRevision The revision number the client based their operation on.
     * @param operation      The operation from the client.
     * @return The transformed operation that was applied.
     * @throws IllegalArgumentException if the clientRevision is invalid or transformation/application fails.
     */
    public TextOperation receiveOperation(String sessionId, String documentId, int clientRevision, TextOperation operation) throws IllegalArgumentException {
        serviceLock.lock(); // Using global lock for simplicity
        try {
            DocumentState state = getOrCreateDocumentState(sessionId, documentId);
            int serverRevision = state.operationHistory.size();
            logger.info(String.format("[Session: %s, Doc: %s] Received op based on client rev %d (Server rev: %d). Op: %s",
                    sessionId, documentId, clientRevision, serverRevision, operation));

            // --- Validate Revision ---
            if (clientRevision < 0 || clientRevision > serverRevision) {
                throw new IllegalArgumentException(
                        String.format("[Session: %s, Doc: %s] Invalid client revision: %d. Server revision is: %d.", sessionId, documentId, clientRevision, serverRevision)
                );
            }

            // --- Find Concurrent Operations ---
            List<TextOperation> concurrentOps = state.operationHistory.subList(clientRevision, serverRevision);
            logger.fine(String.format("[Session: %s, Doc: %s] Found %d concurrent operations to transform against.", sessionId, documentId, concurrentOps.size()));

            // --- Transform Operation ---
            TextOperation transformedOp = operation;
            for (int i = 0; i < concurrentOps.size(); i++) {
                TextOperation concurrentOp = concurrentOps.get(i);
                logger.finest(String.format("[Session: %s, Doc: %s] Transforming against concurrent op [%d]: %s", sessionId, documentId, clientRevision + i, concurrentOp));
                try {
                    List<TextOperation> pair = OtUtils.transform(transformedOp, concurrentOp);
                    transformedOp = pair.get(0);
                    logger.finest(String.format("[Session: %s, Doc: %s]  -> Transformed op: %s", sessionId, documentId, transformedOp));
                } catch (Exception e) {
                    logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Error during transformation step %d. Op: %s, Concurrent: %s", sessionId, documentId, i, transformedOp, concurrentOp), e);
                    throw new IllegalArgumentException("Transformation failed: " + e.getMessage(), e);
                }
            }
            logger.fine(String.format("[Session: %s, Doc: %s] Final transformed operation: %s", sessionId, documentId, transformedOp));

            // --- Apply Transformed Operation ---
            try {
                logger.info(String.format("[Session: %s, Doc: %s] Attempting to apply op [Rev %d]: %s to doc state (length %d): '%s'",
                         sessionId, documentId, state.operationHistory.size(), transformedOp, state.content.length(), state.content));
                state.content = OtUtils.apply(state.content, transformedOp);
                logger.fine(String.format("[Session: %s, Doc: %s] Applied transformed operation. New doc length: %d", sessionId, documentId, state.content.length()));
                logger.finest(String.format("[Session: %s, Doc: %s] New document content snippet: %s", sessionId, documentId, (state.content.length() > 100 ? state.content.substring(0, 100) + "..." : state.content)));
            } catch (Exception e) {
                 logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Error applying transformed operation: %s to doc state: '%s'", sessionId, documentId, transformedOp, state.content), e);
                 throw new IllegalArgumentException("Apply failed: " + e.getMessage(), e);
            }

            // --- Add to History ---
            state.operationHistory.add(transformedOp);
            logger.fine(String.format("[Session: %s, Doc: %s] Added transformed op to history. New server revision: %d", sessionId, documentId, state.operationHistory.size()));

            // --- Prune History (Per Session/Document) ---
            pruneHistory(state, sessionId, documentId);

            // Return the transformed operation for broadcasting
            return transformedOp;

        } finally {
            serviceLock.unlock();
        }
    }

    /** Prunes the operation history for a specific document within a session if it exceeds the maximum size */
    private void pruneHistory(DocumentState state, String sessionId, String documentId) {
        if (state.operationHistory.size() > MAX_HISTORY_SIZE_PER_DOC) {
            int removeCount = state.operationHistory.size() - (MAX_HISTORY_SIZE_PER_DOC / 2);
            if (removeCount > 0) {
                state.operationHistory.subList(0, removeCount).clear();
                logger.info(String.format("[Session: %s, Doc: %s] Pruned operation history. Removed %d ops. New size: %d",
                        sessionId, documentId, removeCount, state.operationHistory.size()));
            }
        }
    }

    /**
     * Sets the document content directly for a specific document within a specific session and resets its history.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @param content The new document content.
     */
    public void setDocumentContent(String sessionId, String documentId, String content) {
        serviceLock.lock();
        try {
            DocumentState state = getOrCreateDocumentState(sessionId, documentId);
            state.content = (content != null) ? content : "";
            state.operationHistory.clear();
            logger.info(String.format("[Session: %s, Doc: %s] Document content set directly. History cleared. New revision: 0", sessionId, documentId));
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Resets the state for a specific document within a specific session.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document to reset.
     */
    public void resetSessionDocument(String sessionId, String documentId) {
        serviceLock.lock();
        try {
            Map<String, DocumentState> documentMap = sessionDocuments.get(sessionId);
            if (documentMap != null) {
                DocumentState state = documentMap.remove(documentId); // Remove from inner map
                if (state != null) {
                    logger.info(String.format("[Session: %s, Doc: %s] Document state has been reset and removed.", sessionId, documentId));
                    // If the inner map becomes empty, remove the session entry
                    if (documentMap.isEmpty()) {
                         sessionDocuments.remove(sessionId);
                         logger.info(String.format("Removed empty document map for session ID: %s", sessionId));
                    }
                } else {
                    logger.warning(String.format("[Session: %s] Attempted to reset non-existent document: %s", sessionId, documentId));
                }
            } else {
                logger.warning(String.format("Attempted to reset document in non-existent session: %s", sessionId));
            }
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Resets the state for ALL documents within a specific session.
     * @param sessionId The identifier of the session to reset.
     */
     public void resetSession(String sessionId) {
        serviceLock.lock();
        try {
            if (sessionDocuments.remove(sessionId) != null) {
                logger.info(String.format("All document states for session ID: %s have been reset.", sessionId));
            } else {
                 logger.warning(String.format("Attempted to reset non-existent session: %s", sessionId));
            }
        } finally {
            serviceLock.unlock();
        }
     }

    /**
     * Reset the state for ALL documents across ALL sessions. Use with caution.
     */
    public void resetAll() {
        serviceLock.lock();
        try {
            sessionDocuments.clear();
            logger.info("All document states across all sessions have been reset.");
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Gets a copy of the operation history for a specific document within a specific session.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @return A list of all operations in the document's history, or an empty list if not found.
     */
    public List<TextOperation> getOperationHistory(String sessionId, String documentId) {
        serviceLock.lock();
        try {
            Map<String, DocumentState> documentMap = sessionDocuments.get(sessionId);
            if (documentMap != null) {
                DocumentState state = documentMap.get(documentId);
                if (state != null) {
                    return new ArrayList<>(state.operationHistory);
                }
            }
            return Collections.emptyList(); // Return empty list if session or document doesn't exist
        } finally {
            serviceLock.unlock();
        }
    }
}