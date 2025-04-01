package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.OperationType;
import com.codecafe.backend.dto.VersionVector;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Logger;

@Service
public class OtService {
    private static final Logger logger = Logger.getLogger(OtService.class.getName());
    private static final int MAX_HISTORY_SIZE = 500;

    private String documentContent = "";
    private VersionVector serverVersionVector = new VersionVector(new HashMap<>());
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
     * Gets the current server version vector
     */
    public VersionVector getServerVersionVector() {
        lock.lock();
        try {
            return new VersionVector(new HashMap<>(serverVersionVector.getVersions()));
        } finally {
            lock.unlock();
        }
    }

    /**
     * Process an incoming operation, transform if necessary, and apply to document
     *
     * @param operation The operation to process
     * @return The operation with updated version vector
     */
    public TextOperation processOperation(TextOperation operation) {
        lock.lock();
        try {
            logger.info("Processing operation: " + operation);
            String userId = operation.getUserId();

            // Handle case of null version vector
            if (operation.getBaseVersionVector() == null || operation.getBaseVersionVector().getVersions() == null) {
                VersionVector initialVector = new VersionVector(new HashMap<>());
                operation.setBaseVersionVector(initialVector);
            }

            // Find concurrent operations not known to the client
            List<TextOperation> concurrentOps = findConcurrentOperations(operation);
            logger.info("Found " + concurrentOps.size() + " concurrent operations");

            // Sort operations for consistent transformation
            concurrentOps.sort((a, b) -> {
                // First compare by user ID
                int userCompare = a.getUserId().compareTo(b.getUserId());
                if (userCompare != 0) {
                    return userCompare;
                }
                // Then by version number if from same user
                int versionA = a.getBaseVersionVector().getVersions().getOrDefault(a.getUserId(), 0);
                int versionB = b.getBaseVersionVector().getVersions().getOrDefault(b.getUserId(), 0);
                return Integer.compare(versionA, versionB);
            });

            // Transform operation against all concurrent operations
            TextOperation transformedOp = cloneOperation(operation);
            for (TextOperation concurrentOp : concurrentOps) {
                transformedOp = transformOperation(transformedOp, concurrentOp);
                logger.fine("Transformed against: " + concurrentOp.getId() + ", result: " + transformedOp);
            }

            // Validate the transformed operation
            validateOperation(transformedOp);

            // Apply the operation to the document
            applyOperation(transformedOp);

            // Create a new version vector that includes this operation
            Map<String, Integer> newVersions = new HashMap<>(serverVersionVector.getVersions());
            int userVersion = newVersions.getOrDefault(userId, 0) + 1;
            newVersions.put(userId, userVersion);
            VersionVector newServerVector = new VersionVector(newVersions);

            // Update server state and operation
            serverVersionVector = newServerVector;
            transformedOp.setBaseVersionVector(new VersionVector(newVersions));

            // Add to history with pruning if needed
            operationHistory.add(transformedOp);
            if (operationHistory.size() > MAX_HISTORY_SIZE) {
                operationHistory.subList(0, operationHistory.size() - MAX_HISTORY_SIZE / 2).clear();
            }

            logger.info("New document state: " + documentContent);
            logger.info("New server version vector: " + serverVersionVector);
            return transformedOp;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Find operations that are concurrent with the given operation
     */
    private List<TextOperation> findConcurrentOperations(TextOperation operation) {
        List<TextOperation> concurrent = new ArrayList<>();
        VersionVector clientVector = operation.getBaseVersionVector();

        if (clientVector == null || clientVector.getVersions() == null) {
            return new ArrayList<>();
        }

        for (TextOperation historyOp : operationHistory) {
            // Skip our own operations
            if (historyOp.getUserId().equals(operation.getUserId())) {
                continue;
            }

            // Check if operations are concurrent
            if (isConcurrent(operation, historyOp)) {
                concurrent.add(historyOp);
            }
        }
        return concurrent;
    }

    /**
     * Check if two operations are concurrent (neither happened before the other)
     */
    private boolean isConcurrent(TextOperation opA, TextOperation opB) {
        return !happenedBefore(opA, opB) && !happenedBefore(opB, opA);
    }

    /**
     * Check if operation A happened before operation B
     */
    private boolean happenedBefore(TextOperation opA, TextOperation opB) {
        VersionVector vectorA = opA.getBaseVersionVector();
        VersionVector vectorB = opB.getBaseVersionVector();

        // Skip if either vector is null
        if (vectorA == null || vectorB == null ||
                vectorA.getVersions() == null || vectorB.getVersions() == null) {
            return false;
        }

        // Check if B knows about all changes in A
        boolean hasChangesNotInB = false;
        for (String userId : vectorA.getVersions().keySet()) {
            int versionInA = vectorA.getVersions().get(userId);
            int versionInB = vectorB.getVersions().getOrDefault(userId, 0);

            if (versionInA > versionInB) {
                hasChangesNotInB = true;
                break;
            }
        }

        if (!hasChangesNotInB) {
            return false;
        }

        // Check if B has additional changes not in A
        for (String userId : vectorB.getVersions().keySet()) {
            int versionInB = vectorB.getVersions().get(userId);
            int versionInA = vectorA.getVersions().getOrDefault(userId, 0);

            if (versionInB > versionInA) {
                return false;
            }
        }

        return true;
    }

    /**
     * Apply an operation to the document
     */
    private void applyOperation(TextOperation operation) {
        StringBuilder sb = new StringBuilder(documentContent);

        // Handle special newline normalization for consistent behavior
        String text = operation.getText();
        if (text != null) {
            text = text.replace("\r\n", "\n");
            operation.setText(text);
        }

        switch (operation.getType()) {
            case INSERT:
                if (operation.getPosition() <= sb.length()) {
                    sb.insert(operation.getPosition(), operation.getText());
                }
                break;
            case DELETE:
                if (operation.getPosition() + operation.getLength() <= sb.length()) {
                    sb.delete(operation.getPosition(), operation.getPosition() + operation.getLength());
                }
                break;
            case REPLACE:
                if (operation.getPosition() + operation.getLength() <= sb.length()) {
                    sb.replace(operation.getPosition(), operation.getPosition() + operation.getLength(), operation.getText());
                }
                break;
        }
        documentContent = sb.toString();
    }

    /**
     * Transform operation A against operation B
     */
    private TextOperation transformOperation(TextOperation clientOp, TextOperation serverOp) {
        TextOperation transformed = cloneOperation(clientOp);

        // No need to transform if they're from the same user or it's the same operation
        if (clientOp.getUserId().equals(serverOp.getUserId()) ||
                (clientOp.getId() != null && clientOp.getId().equals(serverOp.getId()))) {
            return transformed;
        }

        switch (serverOp.getType()) {
            case INSERT:
                transformed.setPosition(transformPositionForInsert(
                        transformed.getPosition(),
                        serverOp.getPosition(),
                        serverOp.getText().length(),
                        clientOp.getUserId(),
                        serverOp.getUserId()
                ));

                // Adjust length for delete/replace operations if server inserted within their range
                if ((transformed.getType() == OperationType.DELETE || transformed.getType() == OperationType.REPLACE) &&
                        transformed.getLength() != null) {
                    int endPos = transformed.getPosition() + transformed.getLength();
                    if (serverOp.getPosition() >= transformed.getPosition() && serverOp.getPosition() <= endPos) {
                        transformed.setLength(transformed.getLength() + serverOp.getText().length());
                    }
                }
                break;

            case DELETE:
                int serverDeleteEnd = serverOp.getPosition() + serverOp.getLength();

                // Adjust position based on delete operation
                transformed.setPosition(transformPositionForDelete(
                        transformed.getPosition(),
                        serverOp.getPosition(),
                        serverOp.getLength()
                ));

                // Adjust length for delete/replace operations
                if ((transformed.getType() == OperationType.DELETE || transformed.getType() == OperationType.REPLACE) &&
                        transformed.getLength() != null) {
                    transformed.setLength(transformLengthForDelete(
                            transformed.getPosition(),
                            transformed.getLength(),
                            serverOp.getPosition(),
                            serverOp.getLength()
                    ));
                }
                break;

            case REPLACE:
                // Handle replace as a delete followed by an insert
                TextOperation deleteOp = new TextOperation();
                deleteOp.setType(OperationType.DELETE);
                deleteOp.setPosition(serverOp.getPosition());
                deleteOp.setLength(serverOp.getLength());
                deleteOp.setBaseVersionVector(serverOp.getBaseVersionVector());
                deleteOp.setUserId(serverOp.getUserId());

                TextOperation insertOp = new TextOperation();
                insertOp.setType(OperationType.INSERT);
                insertOp.setPosition(serverOp.getPosition());
                insertOp.setText(serverOp.getText());
                insertOp.setBaseVersionVector(serverOp.getBaseVersionVector());
                insertOp.setUserId(serverOp.getUserId());

                // Transform against delete, then against insert
                TextOperation afterDelete = transformOperation(transformed, deleteOp);
                transformed = transformOperation(afterDelete, insertOp);
                break;
        }

        return transformed;
    }

    /**
     * Transform a position based on an insert operation
     * @param position The position to transform
     * @param insertPos The position of the insert
     * @param insertLen The length of the inserted text
     * @param clientId Client user ID for tie-breaking
     * @param serverId Server user ID for tie-breaking
     * @return The transformed position
     */
    private int transformPositionForInsert(int position, int insertPos, int insertLen, String clientId, String serverId) {
        if (position < insertPos) {
            return position;
        } else if (position == insertPos) {
            // Consistent tie-breaking using string comparison
            return clientId.compareTo(serverId) <= 0 ? position : position + insertLen;
        } else {
            return position + insertLen;
        }
    }

    /**
     * Transform a position based on a delete operation
     * @param position The position to transform
     * @param deletePos The position of the delete
     * @param deleteLen The length of the deleted text
     * @return The transformed position
     */
    private int transformPositionForDelete(int position, int deletePos, int deleteLen) {
        if (position <= deletePos) {
            return position;
        } else if (position >= deletePos + deleteLen) {
            return position - deleteLen;
        } else {
            return deletePos;
        }
    }

    /**
     * Transform a length when operation overlaps with a delete operation
     * @param pos The position of the operation
     * @param len The length of the operation
     * @param deletePos The position of the delete
     * @param deleteLen The length of the delete
     * @return The transformed length
     */
    private int transformLengthForDelete(int pos, int len, int deletePos, int deleteLen) {
        int endPos = pos + len;
        int deleteEndPos = deletePos + deleteLen;

        // No overlap
        if (endPos <= deletePos || pos >= deleteEndPos) {
            return len;
        }

        // Delete entirely contains operation
        if (pos >= deletePos && endPos <= deleteEndPos) {
            return 0;
        }

        // Operation entirely contains delete
        if (pos <= deletePos && endPos >= deleteEndPos) {
            return len - deleteLen;
        }

        // Delete overlaps with start of operation
        if (pos < deletePos && endPos > deletePos && endPos <= deleteEndPos) {
            return deletePos - pos;
        }

        // Delete overlaps with end of operation
        if (pos >= deletePos && pos < deleteEndPos && endPos > deleteEndPos) {
            return endPos - deleteEndPos;
        }

        // Shouldn't get here
        return 0;
    }

    /**
     * Create a clone of a TextOperation
     * @param operation The operation to clone
     * @return A deep copy of the operation
     */
    private TextOperation cloneOperation(TextOperation operation) {
        TextOperation clone = new TextOperation();
        clone.setId(operation.getId());
        clone.setType(operation.getType());
        clone.setPosition(operation.getPosition());
        clone.setText(operation.getText());
        clone.setLength(operation.getLength());
        clone.setUserId(operation.getUserId());

        if (operation.getBaseVersionVector() != null) {
            Map<String, Integer> versionCopy = new HashMap<>();
            if (operation.getBaseVersionVector().getVersions() != null) {
                versionCopy.putAll(operation.getBaseVersionVector().getVersions());
            }
            clone.setBaseVersionVector(new VersionVector(versionCopy));
        }

        return clone;
    }

    /**
     * Validate an operation to ensure it can be applied to the document
     * @param operation The operation to validate
     */
    private void validateOperation(TextOperation operation) {
        // Get the current document length
        int docLength = documentContent.length();

        // Ensure position is within bounds
        if (operation.getPosition() < 0) {
            operation.setPosition(0);
            logger.warning("Adjusted negative position to 0");
        }

        if (operation.getPosition() > docLength) {
            operation.setPosition(docLength);
            logger.warning("Adjusted out-of-bounds position to document length: " + docLength);
        }

        // Validate length for DELETE and REPLACE operations
        if (operation.getType() == OperationType.DELETE || operation.getType() == OperationType.REPLACE) {
            if (operation.getLength() == null || operation.getLength() < 0) {
                operation.setLength(0);
                logger.warning("Adjusted invalid length to 0");
            }

            int endPos = operation.getPosition() + operation.getLength();
            if (endPos > docLength) {
                operation.setLength(docLength - operation.getPosition());
                logger.warning("Adjusted out-of-bounds length to: " + operation.getLength());
            }
        }

        // Validate text for INSERT and REPLACE operations
        if (operation.getType() == OperationType.INSERT || operation.getType() == OperationType.REPLACE) {
            if (operation.getText() == null) {
                operation.setText("");
                logger.warning("Set null text to empty string");
            }
        }
    }

    /**
     * Sets the document content directly (use with caution)
     * @param content The new document content
     */
    public void setDocumentContent(String content) {
        lock.lock();
        try {
            documentContent = content;
            // Reset version vector when setting document content directly
            serverVersionVector = new VersionVector(new HashMap<>());
            operationHistory.clear();
            logger.info("Document content set directly. History cleared.");
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
            serverVersionVector = new VersionVector(new HashMap<>());
            operationHistory.clear();
            logger.info("OT service has been reset");
        } finally {
            lock.unlock();
        }
    }

    /**
     * Gets all operations in the history for debugging
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

    /**
     * Get operations that happened after a given version vector
     * @param clientVector The client's version vector
     * @return A list of operations that the client hasn't seen
     */
    public List<TextOperation> getOperationsSince(VersionVector clientVector) {
        lock.lock();
        try {
            List<TextOperation> missingOps = new ArrayList<>();

            if (clientVector == null || clientVector.getVersions() == null) {
                return missingOps;
            }

            for (TextOperation op : operationHistory) {
                // Check if client has seen this operation
                String opUserId = op.getUserId();
                int opVersion = op.getBaseVersionVector().getVersions().getOrDefault(opUserId, 0);
                int clientVersion = clientVector.getVersions().getOrDefault(opUserId, 0);

                if (opVersion > clientVersion) {
                    missingOps.add(cloneOperation(op));
                }
            }

            return missingOps;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Calculate the document state at a specific version vector
     * @param targetVector The version vector to calculate document state for
     * @return The document content at the specified version
     */
    public String getDocumentAtVersion(VersionVector targetVector) {
        lock.lock();
        try {
            if (targetVector == null || targetVector.getVersions() == null) {
                return "";
            }

            // Start with empty document
            StringBuilder tempDoc = new StringBuilder();

            // Find operations that are known by the target version
            List<TextOperation> relevantOps = new ArrayList<>();
            for (TextOperation op : operationHistory) {
                if (isKnownByVector(op, targetVector)) {
                    relevantOps.add(op);
                }
            }

            // Apply operations in order
            for (TextOperation op : relevantOps) {
                applyOperationTo(tempDoc, op);
            }

            return tempDoc.toString();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Check if an operation is known by a version vector
     */
    private boolean isKnownByVector(TextOperation op, VersionVector vector) {
        String opUserId = op.getUserId();
        int opVersion = op.getBaseVersionVector().getVersions().getOrDefault(opUserId, 0) + 1;
        int vectorVersion = vector.getVersions().getOrDefault(opUserId, 0);

        return vectorVersion >= opVersion;
    }

    /**
     * Apply an operation to a StringBuilder
     */
    private void applyOperationTo(StringBuilder doc, TextOperation operation) {
        String text = operation.getText();
        if (text != null) {
            text = text.replace("\r\n", "\n");
        }

        switch (operation.getType()) {
            case INSERT:
                if (operation.getPosition() <= doc.length()) {
                    doc.insert(operation.getPosition(), text);
                }
                break;
            case DELETE:
                if (operation.getPosition() + operation.getLength() <= doc.length()) {
                    doc.delete(operation.getPosition(), operation.getPosition() + operation.getLength());
                }
                break;
            case REPLACE:
                if (operation.getPosition() + operation.getLength() <= doc.length()) {
                    doc.replace(operation.getPosition(), operation.getPosition() + operation.getLength(), text);
                }
                break;
        }
    }
}