package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.OperationType;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;
import java.util.Objects;

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

            // Trim history if it gets too large
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
     * Transforms operation 'a' against operation 'b'.
     * This function assumes 'b' has already been applied to the document state
     * that 'a' was based on. It modifies 'a' so it can be applied to the document
     * state *after* 'b' has been applied.
     *
     * @param a The operation to transform.
     * @param b The operation to transform against (considered to happen concurrently/before a).
     * @return The transformed operation 'a'.
     */
    private TextOperation transformOperation(TextOperation a, TextOperation b) {
        // Clone operation 'a' to avoid modifying the original
        TextOperation transformedA = a.clone();

        // If operations are identical, no transform needed
        if (transformedA.equals(b)) {
            return transformedA;
        }

        // No transformation needed if operations are from same user or if 'b' is effectively in the past
        if (b.getVersion() < transformedA.getVersion() || Objects.equals(transformedA.getUserId(), b.getUserId())) {
            return transformedA;
        }

        // Core transformation logic based on operation types
        switch (b.getType()) {
            case INSERT:
                transformAgainstInsert(transformedA, b);
                break;

            case DELETE:
                transformAgainstDelete(transformedA, b);
                break;

            case REPLACE:
                // Treat REPLACE as DELETE followed by INSERT
                TextOperation deletePartOfB = new TextOperation();
                deletePartOfB.setType(OperationType.DELETE);
                deletePartOfB.setPosition(b.getPosition());
                deletePartOfB.setLength(b.getLength());
                deletePartOfB.setVersion(b.getVersion());
                deletePartOfB.setUserId(b.getUserId());

                TextOperation insertPartOfB = new TextOperation();
                insertPartOfB.setType(OperationType.INSERT);
                insertPartOfB.setPosition(b.getPosition());
                insertPartOfB.setText(b.getText());
                insertPartOfB.setVersion(b.getVersion());
                insertPartOfB.setUserId(b.getUserId());

                // Transform against DELETE then INSERT
                TextOperation tempTransformedA = transformOperation(transformedA, deletePartOfB);
                transformedA = transformOperation(tempTransformedA, insertPartOfB);
                break;
        }

        return transformedA;
    }

    /**
     * Helper method to transform an operation against an INSERT operation
     */
    private void transformAgainstInsert(TextOperation transformedA, TextOperation opB_Insert) {
        int aPos = transformedA.getPosition();
        int bPos = opB_Insert.getPosition();
        int bLen = opB_Insert.getText() != null ? opB_Insert.getText().length() : 0;

        if (bLen == 0) return; // Nothing to transform against

        // If 'b' inserts at or before 'a's position, shift 'a' forward
        if (bPos < aPos) {
            transformedA.setPosition(aPos + bLen);
        }
        // If 'b' inserts exactly at 'a's position, apply tie-breaking
        else if (bPos == aPos) {
            // Tie-breaking rule: operation from user with lexicographically smaller ID comes first
            if (transformedA.getType() == OperationType.INSERT) {
                String aUserId = transformedA.getUserId() != null ? transformedA.getUserId() : "";
                String bUserId = opB_Insert.getUserId() != null ? opB_Insert.getUserId() : "";
                if (aUserId.compareTo(bUserId) > 0) {
                    // If 'a's user ID is "greater", assume 'a' comes after 'b's insert
                    transformedA.setPosition(aPos + bLen);
                }
                // else 'a' comes first, position unchanged
            } else {
                // If 'a' is DELETE/REPLACE starting at bPos, b's insert happens before it
                transformedA.setPosition(aPos + bLen);
            }
        }
        // If 'b' inserts after 'a's position, 'a' is unaffected
    }

    /**
     * Helper method to transform an operation against a DELETE operation
     */
    private void transformAgainstDelete(TextOperation transformedA, TextOperation opB_Delete) {
        int aPos = transformedA.getPosition();
        int aLen = transformedA.getLength() != null ? transformedA.getLength() : 0;
        int aEnd = aPos + aLen;

        int bPos = opB_Delete.getPosition();
        int bLen = opB_Delete.getLength() != null ? opB_Delete.getLength() : 0;
        int bEnd = bPos + bLen;

        if (bLen == 0) return; // Nothing to transform against

        // Case 1: 'b' deletes entirely before 'a' starts
        if (bEnd <= aPos) {
            transformedA.setPosition(aPos - bLen);
        }
        // Case 2: 'b' deletes entirely after 'a' ends
        else if (bPos >= aEnd) {
            // Position and length of 'a' remain unchanged
        }
        // Case 3: 'b' deletes a range that completely contains 'a'
        else if (bPos <= aPos && bEnd >= aEnd) {
            transformedA.setPosition(bPos);
            if (transformedA.getType() == OperationType.INSERT) {
                // Insert is contained within deletion, nothing changes about the insert text
            } else {
                transformedA.setLength(0); // Delete/Replace becomes zero length
            }
        }
        // Case 4: 'b' deletes a range that starts before 'a' and overlaps with the beginning of 'a'
        else if (bPos < aPos && bEnd > aPos && bEnd < aEnd) {
            int deletedLength = bEnd - aPos;
            transformedA.setPosition(bPos); // 'a' now starts where 'b' started deleting
            if (transformedA.getType() != OperationType.INSERT) {
                transformedA.setLength(aLen - deletedLength); // Reduce length of 'a'
            }
        }
        // Case 5: 'b' deletes a range that starts within 'a' and ends after 'a'
        else if (bPos >= aPos && bPos < aEnd && bEnd >= aEnd) {
            // 'a's position is unchanged
            if (transformedA.getType() != OperationType.INSERT) {
                transformedA.setLength(bPos - aPos); // 'a' is truncated
            }
        }
        // Case 6: 'b' deletes a range that is completely within 'a'
        else if (bPos > aPos && bEnd < aEnd) {
            // 'a's position is unchanged
            if (transformedA.getType() != OperationType.INSERT) {
                transformedA.setLength(aLen - bLen); // 'a' becomes shorter
            }
        }
    }
}