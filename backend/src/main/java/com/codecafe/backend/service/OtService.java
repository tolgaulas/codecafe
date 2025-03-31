package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.OperationType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class OtService {
    private String documentContent = "";
    private int currentVersion = 0;
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
     * Gets the current document version
     */
    public int getCurrentVersion() {
        lock.lock();
        try {
            return currentVersion;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Process an incoming operation, transform if necessary, and apply to document
     *
     * @param operation The operation to process
     * @return The operation with updated version
     */
    public TextOperation processOperation(TextOperation operation) {
        lock.lock();
        try {
            System.out.println("Processing operation: " + operation);

            // If operation is too old, transform it against all operations since its base version
            if (operation.getVersion() < currentVersion) {
                List<TextOperation> operationsToTransformAgainst = new ArrayList<>();

                // Collect all operations that need to be considered for transformation
                for (TextOperation historyOp : operationHistory) {
                    if (historyOp.getVersion() >= operation.getVersion() &&
                            !historyOp.getUserId().equals(operation.getUserId())) {
                        operationsToTransformAgainst.add(historyOp);
                    }
                }

                // Sort operations by version to transform in the correct order
                operationsToTransformAgainst.sort((a, b) ->
                        Integer.compare(a.getVersion(), b.getVersion()));

                // Transform against each operation
                for (TextOperation historyOp : operationsToTransformAgainst) {
                    operation = transformOperation(operation, historyOp);
                }
            }

            // Apply the operation to the document
            applyOperation(operation);

            // Update the version and add to history
            currentVersion++;
            operation.setVersion(currentVersion);
            operationHistory.add(operation);

            // Trim history if it gets too large (optional)
            if (operationHistory.size() > 100) {
                operationHistory.remove(0);
            }

            System.out.println("New document state: " + documentContent + ", version: " + currentVersion);
            return operation;
        } finally {
            lock.unlock();
        }
    }

    /**
     * Apply an operation to the document
     *
     * @param operation The operation to apply
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
     *
     * @param a Operation to transform
     * @param b Operation to transform against
     * @return Transformed operation
     */
    private TextOperation transformOperation(TextOperation clientOp, TextOperation serverOp) {
        // Clone the client operation to avoid modifying the original
        TextOperation transformed = cloneOperation(clientOp);

        // If operations are from the same user, no transform needed
        if (clientOp.getUserId().equals(serverOp.getUserId())) {
            return transformed;
        }

        // Transform position based on operation types
        switch (serverOp.getType()) {
            case INSERT:
                transformed.setPosition(transformPosition(
                        transformed.getPosition(),
                        serverOp.getPosition(),
                        serverOp.getText().length(),
                        true
                ));

                // If client op is DELETE or REPLACE, we may need to adjust length too
                if ((transformed.getType() == OperationType.DELETE ||
                        transformed.getType() == OperationType.REPLACE) &&
                        transformed.getLength() != null) {

                    // Check if server insert is inside client's deletion range
                    int clientOpEnd = transformed.getPosition() + transformed.getLength();
                    if (serverOp.getPosition() > transformed.getPosition() &&
                            serverOp.getPosition() < clientOpEnd) {
                        transformed.setLength(transformed.getLength() + serverOp.getText().length());
                    }
                }
                break;

            case DELETE:
                int serverOpEnd = serverOp.getPosition() + serverOp.getLength();

                // Transform the position
                transformed.setPosition(transformPositionAgainstDelete(
                        transformed.getPosition(),
                        serverOp.getPosition(),
                        serverOp.getLength()
                ));

                // If client op is DELETE or REPLACE, handle length adjustment
                if ((transformed.getType() == OperationType.DELETE ||
                        transformed.getType() == OperationType.REPLACE) &&
                        transformed.getLength() != null) {

                    // Calculate deletion overlap and adjust length accordingly
                    transformed.setLength(transformLengthAgainstDelete(
                            transformed.getPosition(),
                            transformed.getLength(),
                            serverOp.getPosition(),
                            serverOp.getLength()
                    ));
                }
                break;

            case REPLACE:
                // Handle REPLACE as DELETE followed by INSERT
                TextOperation deleteOp = new TextOperation();
                deleteOp.setType(OperationType.DELETE);
                deleteOp.setPosition(serverOp.getPosition());
                deleteOp.setLength(serverOp.getLength());
                deleteOp.setVersion(serverOp.getVersion());
                deleteOp.setUserId(serverOp.getUserId());

                TextOperation insertOp = new TextOperation();
                insertOp.setType(OperationType.INSERT);
                insertOp.setPosition(serverOp.getPosition());
                insertOp.setText(serverOp.getText());
                insertOp.setVersion(serverOp.getVersion());
                insertOp.setUserId(serverOp.getUserId());

                // Transform against delete and then insert
                transformed = transformOperation(transformed, deleteOp);
                transformed = transformOperation(transformed, insertOp);
                break;
        }

        return transformed;
    }

    // Helper methods for transformations
    private int transformPosition(int position, int otherPosition, int otherLength, boolean isInsert) {
        if (position <= otherPosition) {
            return position; // Position before the other operation is unchanged
        } else {
            // Position after the other operation is shifted
            return isInsert ? position + otherLength : Math.max(otherPosition, position - otherLength);
        }
    }

    private int transformPositionAgainstDelete(int position, int deletePos, int deleteLen) {
        if (position <= deletePos) {
            return position; // Before deletion point - unaffected
        } else if (position >= deletePos + deleteLen) {
            return position - deleteLen; // After deletion - shift left
        } else {
            return deletePos; // Inside deletion range - move to deletion start
        }
    }

    private int transformLengthAgainstDelete(int pos, int len, int deletePos, int deleteLen) {
        int endPos = pos + len;
        int deleteEndPos = deletePos + deleteLen;

        // No overlap
        if (endPos <= deletePos || pos >= deleteEndPos) {
            return len;
        }

        // Client deletion is completely inside server deletion
        if (pos >= deletePos && endPos <= deleteEndPos) {
            return 0;
        }

        // Server deletion is completely inside client deletion
        if (deletePos >= pos && deleteEndPos <= endPos) {
            return len - deleteLen;
        }

        // Partial overlap, server deletion overlaps start of client deletion
        if (deletePos <= pos && deleteEndPos > pos) {
            return endPos - deleteEndPos;
        }

        // Partial overlap, server deletion overlaps end of client deletion
        if (deletePos < endPos && deleteEndPos >= endPos) {
            return deletePos - pos;
        }

        // Should never reach here
        return len;
    }

    private TextOperation cloneOperation(TextOperation operation) {
        TextOperation clone = new TextOperation();
        clone.setId(operation.getId());
        clone.setType(operation.getType());
        clone.setPosition(operation.getPosition());
        clone.setText(operation.getText());
        clone.setLength(operation.getLength());
        clone.setVersion(operation.getVersion());
        clone.setUserId(operation.getUserId());
        return clone;
    }
}
