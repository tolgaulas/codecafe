package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.util.OtUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Logger;
import java.util.logging.Level;

@Service
public class OtService {
    private static final Logger logger = Logger.getLogger(OtService.class.getName());
    private static final int MAX_HISTORY_SIZE = 10000;

    private String documentContent = "";
    private final List<TextOperation> operationHistory = new ArrayList<>();
    private final ReentrantLock lock = new ReentrantLock();

    /**
     * Gets the current document content
     */
    public String getDocumentContent() {
        lock.lock();
        try {
            return documentContent;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Gets the current server revision number
     */
    public int getRevision() {
        lock.lock();
        try {
            return operationHistory.size();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Process an incoming operation from a client against a specified revision.
     * Transforms the operation against concurrent operations, applies it, and adds it to the history.
     * Based on ot.js Server.prototype.receiveOperation
     *
     * @param clientRevision The revision number the client based their operation on.
     * @param operation      The operation from the client (using ot.js TextOperation format).
     * @return The transformed operation that was applied to the document and added to history.
     * @throws IllegalArgumentException if the clientRevision is invalid or transformation fails.
     */
    public TextOperation receiveOperation(int clientRevision, TextOperation operation) throws IllegalArgumentException {
        lock.lock();
        try {
            int serverRevision = operationHistory.size();
            logger.info("Received operation based on client revision " + clientRevision + " (Server revision: " + serverRevision + "). Op: " + operation);

            // --- Validate Revision --- 
            if (clientRevision < 0 || clientRevision > serverRevision) {
                throw new IllegalArgumentException(
                        String.format("Invalid client revision: %d. Server revision is: %d.", clientRevision, serverRevision)
                );
            }

            // --- Find Concurrent Operations --- 
            // Operations that happened on the server after the client's revision
            List<TextOperation> concurrentOps = operationHistory.subList(clientRevision, serverRevision);
            logger.fine("Found " + concurrentOps.size() + " concurrent operations to transform against.");

            // --- Transform Operation --- 
            TextOperation transformedOp = operation; // Start with the original client op
            for (int i = 0; i < concurrentOps.size(); i++) {
                TextOperation concurrentOp = concurrentOps.get(i);
                logger.finest("Transforming against concurrent op [" + (clientRevision + i) + "]: " + concurrentOp);
                try {
                    List<TextOperation> pair = OtUtils.transform(transformedOp, concurrentOp);
                    transformedOp = pair.get(0); // The transformed client op becomes the input for the next step
                    logger.finest(" -> Transformed op: " + transformedOp);
                } catch (Exception e) {
                    // Log the error and potentially rethrow or handle gracefully
                    logger.log(Level.SEVERE, "Error during transformation step " + i + ". Op: " + transformedOp + ", Concurrent: " + concurrentOp, e);
                    throw new IllegalArgumentException("Transformation failed: " + e.getMessage(), e);
                }
            }
            logger.fine("Final transformed operation: " + transformedOp);

            // --- Apply Transformed Operation --- 
            try {
                // Log state right before applying
                logger.info("Attempting to apply op [Rev " + operationHistory.size() + "]: " + transformedOp + " to doc state (length " + documentContent.length() + "): '" + documentContent + "'");
                documentContent = OtUtils.apply(documentContent, transformedOp);
                logger.fine("Applied transformed operation. New doc length: " + documentContent.length());
                 logger.finest("New document content snippet: " + (documentContent.length() > 100 ? documentContent.substring(0, 100) + "..." : documentContent));
            } catch (Exception e) {
                // Log the error and potentially rethrow or handle gracefully
                 logger.log(Level.SEVERE, "Error applying transformed operation: " + transformedOp + " to doc state: '" + documentContent + "'", e);
                 throw new IllegalArgumentException("Apply failed: " + e.getMessage(), e);
            }

            // --- Add to History --- 
            operationHistory.add(transformedOp); // Add the *transformed* operation
            logger.fine("Added transformed op to history. New server revision: " + operationHistory.size());

            // --- Prune History (Optional) ---
            pruneHistory();

            // --- Return Transformed Operation --- 
            // The caller (e.g., WebSocket controller) is responsible for:
            // 1. Sending 'ack' to the original sender.
            // 2. Broadcasting the 'transformedOp' to other clients, along with the new server revision (operationHistory.size()).
            return transformedOp;

        } finally {
            lock.unlock();
        }
    }

    /** Prunes the operation history if it exceeds the maximum size */
    private void pruneHistory() {
        // This simple pruning might break the ability for very old clients to catch up.
        // A more robust solution might involve snapshotting.
        if (operationHistory.size() > MAX_HISTORY_SIZE) {
            int removeCount = operationHistory.size() - (MAX_HISTORY_SIZE / 2);
            if (removeCount > 0) {
            operationHistory.subList(0, removeCount).clear();
                logger.info("Pruned operation history. Removed " + removeCount + " ops. New size: " + operationHistory.size());
                // Important: Pruning invalidates old revision numbers. Clients might need to resync fully.
            }
        }
    }

    /**
     * Sets the document content directly and resets history.
     * @param content The new document content
     */
    public void setDocumentContent(String content) {
        lock.lock();
        try {
            documentContent = (content != null) ? content : "";
            operationHistory.clear();
            logger.info("Document content set directly. History cleared. New revision: 0");
        } finally {
            lock.unlock();
        }
    }

    /**
     * Reset the server state completely
     */
    public void reset() {
        lock.lock();
        try {
            documentContent = "";
            operationHistory.clear();
            logger.info("OT service has been reset. New revision: 0");
        } finally {
            lock.unlock();
        }
    }

    /**
     * Gets a copy of the operation history for debugging/inspection.
     * @return A list of all operations in history
     */
    public List<TextOperation> getOperationHistory() {
        lock.lock();
        try {
            // Return a copy to avoid external modifications
            return new ArrayList<>(operationHistory);
        } finally {
            lock.unlock();
        }
    }
}