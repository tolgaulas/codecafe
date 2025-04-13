package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.util.OtUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Logger;
import java.util.logging.Level;

@Service
public class OtService {
    private static final Logger logger = Logger.getLogger(OtService.class.getName());
    private static final int MAX_HISTORY_SIZE_PER_DOC = 5000; // Adjusted max size per document

    // Inner class to hold state for a single document
    private static class DocumentState {
        String content = "";
        final List<TextOperation> operationHistory = new ArrayList<>();
        // Optional: Could add per-document lock here for finer granularity
        // final ReentrantLock docLock = new ReentrantLock(); 
    }

    // Map to store state for each document, keyed by documentId (e.g., file path)
    private final Map<String, DocumentState> documents = new ConcurrentHashMap<>();

    // Global lock for managing the documents map structure safely (can be bottleneck)
    private final ReentrantLock serviceLock = new ReentrantLock();

    /**
     * Gets or creates the state for a given document ID.
     * Must be called within a locked context (e.g., serviceLock).
     */
    private DocumentState getOrCreateDocumentState(String documentId) {
        return documents.computeIfAbsent(documentId, k -> {
            logger.info("Creating new document state for ID: " + documentId);
            return new DocumentState();
        });
    }

    /**
     * Gets the current content for a specific document.
     * @param documentId The identifier of the document.
     * @return The content of the document.
     */
    public String getDocumentContent(String documentId) {
        serviceLock.lock();
        try {
            DocumentState state = getOrCreateDocumentState(documentId);
            return state.content;
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Gets the current server revision number for a specific document.
     * @param documentId The identifier of the document.
     * @return The revision number for the document.
     */
    public int getRevision(String documentId) {
        serviceLock.lock();
        try {
            DocumentState state = getOrCreateDocumentState(documentId);
            return state.operationHistory.size();
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Process an incoming operation from a client against a specified revision for a specific document.
     * Transforms the operation against concurrent operations, applies it, and adds it to the history for that document.
     *
     * @param documentId     The identifier of the document being modified.
     * @param clientRevision The revision number the client based their operation on (relative to the document's history).
     * @param operation      The operation from the client.
     * @return The transformed operation that was applied to the document and added to its history.
     * @throws IllegalArgumentException if the clientRevision is invalid or transformation/application fails.
     */
    public TextOperation receiveOperation(String documentId, int clientRevision, TextOperation operation) throws IllegalArgumentException {
        serviceLock.lock(); // Using global lock for simplicity, consider per-document lock for performance
        try {
            DocumentState state = getOrCreateDocumentState(documentId);
            int serverRevision = state.operationHistory.size();
            logger.info(String.format("[%s] Received op based on client rev %d (Server rev: %d). Op: %s",
                    documentId, clientRevision, serverRevision, operation));

            // --- Validate Revision ---
            if (clientRevision < 0 || clientRevision > serverRevision) {
                throw new IllegalArgumentException(
                        String.format("[%s] Invalid client revision: %d. Server revision is: %d.", documentId, clientRevision, serverRevision)
                );
            }

            // --- Find Concurrent Operations ---
            List<TextOperation> concurrentOps = state.operationHistory.subList(clientRevision, serverRevision);
            logger.fine(String.format("[%s] Found %d concurrent operations to transform against.", documentId, concurrentOps.size()));

            // --- Transform Operation ---
            TextOperation transformedOp = operation;
            for (int i = 0; i < concurrentOps.size(); i++) {
                TextOperation concurrentOp = concurrentOps.get(i);
                logger.finest(String.format("[%s] Transforming against concurrent op [%d]: %s", documentId, clientRevision + i, concurrentOp));
                try {
                    List<TextOperation> pair = OtUtils.transform(transformedOp, concurrentOp);
                    transformedOp = pair.get(0);
                    logger.finest(String.format("[%s]  -> Transformed op: %s", documentId, transformedOp));
                } catch (Exception e) {
                    logger.log(Level.SEVERE, String.format("[%s] Error during transformation step %d. Op: %s, Concurrent: %s", documentId, i, transformedOp, concurrentOp), e);
                    throw new IllegalArgumentException("Transformation failed: " + e.getMessage(), e);
                }
            }
            logger.fine(String.format("[%s] Final transformed operation: %s", documentId, transformedOp));

            // --- Apply Transformed Operation ---
            try {
                logger.info(String.format("[%s] Attempting to apply op [Rev %d]: %s to doc state (length %d): '%s'",
                         documentId, state.operationHistory.size(), transformedOp, state.content.length(), state.content));
                state.content = OtUtils.apply(state.content, transformedOp);
                logger.fine(String.format("[%s] Applied transformed operation. New doc length: %d", documentId, state.content.length()));
                logger.finest(String.format("[%s] New document content snippet: %s", documentId, (state.content.length() > 100 ? state.content.substring(0, 100) + "..." : state.content)));
            } catch (Exception e) {
                 logger.log(Level.SEVERE, String.format("[%s] Error applying transformed operation: %s to doc state: '%s'", documentId, transformedOp, state.content), e);
                 throw new IllegalArgumentException("Apply failed: " + e.getMessage(), e);
            }

            // --- Add to History ---
            state.operationHistory.add(transformedOp);
            logger.fine(String.format("[%s] Added transformed op to history. New server revision: %d", documentId, state.operationHistory.size()));

            // --- Prune History (Per Document) ---
            pruneHistory(state, documentId);

            // Return the transformed operation for broadcasting
            return transformedOp;

        } finally {
            serviceLock.unlock();
        }
    }

    /** Prunes the operation history for a specific document if it exceeds the maximum size */
    private void pruneHistory(DocumentState state, String documentId) {
        if (state.operationHistory.size() > MAX_HISTORY_SIZE_PER_DOC) {
            int removeCount = state.operationHistory.size() - (MAX_HISTORY_SIZE_PER_DOC / 2);
            if (removeCount > 0) {
                state.operationHistory.subList(0, removeCount).clear();
                logger.info(String.format("[%s] Pruned operation history. Removed %d ops. New size: %d",
                        documentId, removeCount, state.operationHistory.size()));
            }
        }
    }

    /**
     * Sets the document content directly for a specific document and resets its history.
     * @param documentId The identifier of the document.
     * @param content The new document content.
     */
    public void setDocumentContent(String documentId, String content) {
        serviceLock.lock();
        try {
            DocumentState state = getOrCreateDocumentState(documentId);
            state.content = (content != null) ? content : "";
            state.operationHistory.clear();
            logger.info(String.format("[%s] Document content set directly. History cleared. New revision: 0", documentId));
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Reset the state for a specific document.
     * @param documentId The identifier of the document to reset.
     */
    public void resetDocument(String documentId) {
        serviceLock.lock();
        try {
            DocumentState state = documents.get(documentId);
            if (state != null) {
                state.content = "";
                state.operationHistory.clear();
                logger.info(String.format("[%s] Document state has been reset. New revision: 0", documentId));
            } else {
                logger.warning("Attempted to reset non-existent document: " + documentId);
            }
            // Optionally remove the entry entirely? documents.remove(documentId);
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Reset the state for ALL documents.
     */
    public void resetAll() {
        serviceLock.lock();
        try {
            documents.clear();
            logger.info("All document states have been reset.");
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Gets a copy of the operation history for a specific document.
     * @param documentId The identifier of the document.
     * @return A list of all operations in the document's history.
     */
    public List<TextOperation> getOperationHistory(String documentId) {
        serviceLock.lock();
        try {
            DocumentState state = documents.get(documentId); // Don't create if not exists
            if (state != null) {
                return new ArrayList<>(state.operationHistory);
            } else {
                return new ArrayList<>(); // Return empty list if document doesn't exist
            }
        } finally {
            serviceLock.unlock();
        }
    }
}