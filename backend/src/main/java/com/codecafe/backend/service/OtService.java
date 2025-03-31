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

@Service
public class OtService {
    private String documentContent = "";
    private VersionVector serverVersionVector = new VersionVector();
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
            return new VersionVector(serverVersionVector.getVersions());
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
            System.out.println("Processing operation: " + operation);
            String userId = operation.getUserId();

            // Find concurrent operations not known to the client when it created this operation
            List<TextOperation> concurrentOps = findConcurrentOperations(operation);

            // Sort operations to ensure consistent transformation across all clients
            concurrentOps.sort((a, b) -> {
                // First compare by user ID for consistent ordering
                int userCompare = a.getUserId().compareTo(b.getUserId());
                if (userCompare != 0) {
                    return userCompare;
                }
                // Then by version number if from same user
                int versionA = a.getBaseVersionVector().getVersions().getOrDefault(a.getUserId(), 0);
                int versionB = b.getBaseVersionVector().getVersions().getOrDefault(b.getUserId(), 0);
                return Integer.compare(versionA, versionB);
            });

            // Transform the operation against all concurrent operations
            TextOperation transformedOp = operation;
            for (TextOperation concurrentOp : concurrentOps) {
                transformedOp = transformOperation(transformedOp, concurrentOp);
            }

            // Validate transformed operation
            validateOperation(transformedOp);

            // Apply the operation to the document
            applyOperation(transformedOp);

            // Update the server's version vector to include this operation
            VersionVector newBaseVector = new VersionVector(serverVersionVector.getVersions());
            if (transformedOp.getBaseVersionVector() != null && transformedOp.getBaseVersionVector().getVersions() != null) {
                Map<String, Integer> userVersions = transformedOp.getBaseVersionVector().getVersions();
                int userVersion = serverVersionVector.getVersions().getOrDefault(userId, 0) + 1;
                newBaseVector.update(userId, userVersion);
            } else {
                Map<String, Integer> initialVector = new HashMap<>();
                initialVector.put(userId, 1);
                newBaseVector = new VersionVector(initialVector);
            }

            // Update the server's vector and operation
            serverVersionVector = newBaseVector;
            transformedOp.setBaseVersionVector(newBaseVector);

            // Add to history
            operationHistory.add(transformedOp);

            // Trim history if it gets too large (consider a more efficient structure like TreeMap for large histories)
            if (operationHistory.size() > 100) {
                operationHistory.remove(0);
            }

            System.out.println("New document state: " + documentContent);
            System.out.println("New server version vector: " + serverVersionVector);
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
            return new ArrayList<>(operationHistory);
        }

        for (TextOperation historyOp : operationHistory) {
            if (historyOp.getUserId().equals(operation.getUserId())) {
                continue;
            }
            VersionVector historyVector = historyOp.getBaseVersionVector();
            if (historyVector != null && historyVector.getVersions() != null && clientVector.concurrent(historyVector)) {
                concurrent.add(historyOp);
            }
        }
        return concurrent;
    }

    /**
     * Apply an operation to the document
     */
    private void applyOperation(TextOperation operation) {
        StringBuilder sb = new StringBuilder(documentContent);

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
        TextOperation originalClientOp = clientOp; // For tie-breaking reference

        if (clientOp.getUserId().equals(serverOp.getUserId())) {
            return transformed;
        }

        switch (serverOp.getType()) {
            case INSERT:
                transformed.setPosition(transformPosition(
                        transformed.getPosition(),
                        serverOp.getPosition(),
                        serverOp.getText().length(),
                        true,
                        originalClientOp.getUserId(),
                        serverOp.getUserId()
                ));

                if ((transformed.getType() == OperationType.DELETE ||
                        transformed.getType() == OperationType.REPLACE) &&
                        transformed.getLength() != null) {
                    int clientOpEnd = transformed.getPosition() + transformed.getLength();
                    if (serverOp.getPosition() > transformed.getPosition() &&
                            serverOp.getPosition() < clientOpEnd) {
                        transformed.setLength(transformed.getLength() + serverOp.getText().length());
                    }
                }
                break;

            case DELETE:
                int serverOpEnd = serverOp.getPosition() + serverOp.getLength();
                transformed.setPosition(transformPositionAgainstDelete(
                        transformed.getPosition(),
                        serverOp.getPosition(),
                        serverOp.getLength()
                ));

                if ((transformed.getType() == OperationType.DELETE ||
                        transformed.getType() == OperationType.REPLACE) &&
                        transformed.getLength() != null) {
                    transformed.setLength(transformLengthAgainstDelete(
                            transformed.getPosition(),
                            transformed.getLength(),
                            serverOp.getPosition(),
                            serverOp.getLength()
                    ));
                }
                break;

            case REPLACE:
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

                transformed = transformOperation(transformed, deleteOp);
                transformed = transformOperation(transformed, insertOp);
                break;
        }
        return transformed;
    }

    /**
     * Transform position considering tie-breaking for inserts
     */
    private int transformPosition(int position, int otherPosition, int otherLength, boolean isInsert,
                                  String clientUserId, String serverUserId) {
        if (position < otherPosition) {
            return position;
        } else if (position == otherPosition && isInsert) {
            // Tie-breaking: if clientUserId > serverUserId lexicographically, shift position
            if (clientUserId.compareTo(serverUserId) > 0) {
                return position + otherLength;
            } else {
                return position;
            }
        } else {
            return isInsert ? position + otherLength : Math.max(otherPosition, position - otherLength);
        }
    }

    /**
     * Transform position against a delete operation
     */
    private int transformPositionAgainstDelete(int position, int deletePos, int deleteLen) {
        if (position <= deletePos) {
            return position;
        } else if (position >= deletePos + deleteLen) {
            return position - deleteLen;
        } else {
            return deletePos;
        }
    }

    /**
     * Transform length against a delete operation with improved overlap handling
     */
    private int transformLengthAgainstDelete(int pos, int len, int deletePos, int deleteLen) {
        int endPos = pos + len;
        int deleteEndPos = deletePos + deleteLen;

        if (endPos <= deletePos || pos >= deleteEndPos) {
            return len; // No overlap
        }
        if (pos < deletePos) {
            // Server delete overlaps client delete's end
            return deletePos - pos + Math.max(0, endPos - deleteEndPos);
        }
        if (endPos > deleteEndPos) {
            // Server delete overlaps client delete's start
            return endPos - deleteEndPos;
        }
        // Client delete fully contained in server delete
        return 0;
    }

    /**
     * Validate the transformed operation to ensure it’s within bounds
     */
    private void validateOperation(TextOperation operation) {
        if (operation.getPosition() < 0) {
            operation.setPosition(0);
        }
        if (operation.getLength() != null && operation.getLength() < 0) {
            operation.setLength(0);
        }
        int maxPos = documentContent.length();
        if (operation.getPosition() > maxPos) {
            operation.setPosition(maxPos);
        }
        if (operation.getLength() != null && operation.getPosition() + operation.getLength() > maxPos) {
            operation.setLength(maxPos - operation.getPosition());
        }
    }

    /**
     * Clone an operation
     */
    private TextOperation cloneOperation(TextOperation operation) {
        TextOperation clone = new TextOperation();
        clone.setId(operation.getId());
        clone.setType(operation.getType());
        clone.setPosition(operation.getPosition());
        clone.setText(operation.getText());
        clone.setLength(operation.getLength());
        if (operation.getBaseVersionVector() != null) {
            clone.setBaseVersionVector(new VersionVector(operation.getBaseVersionVector().getVersions()));
        }
        clone.setUserId(operation.getUserId());
        return clone;
    }
}