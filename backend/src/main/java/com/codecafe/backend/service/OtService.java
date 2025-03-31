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
    private TextOperation transformOperation(TextOperation a, TextOperation b) {
        // Clone operation A to avoid modifying the original
        TextOperation transformed = new TextOperation();
        transformed.setId(a.getId());
        transformed.setType(a.getType());
        transformed.setPosition(a.getPosition());
        transformed.setText(a.getText());
        transformed.setLength(a.getLength());
        transformed.setVersion(a.getVersion());
        transformed.setUserId(a.getUserId());

        // If operations are from the same user or B happens after A, no transform needed
        if (a.getUserId().equals(b.getUserId()) || b.getVersion() <= a.getVersion()) {
            return transformed;
        }

        // Transform based on operation types
        switch (b.getType()) {
            case INSERT:
                // If B inserts before A's position, shift A's position
                if (b.getPosition() <= transformed.getPosition()) {
                    transformed.setPosition(transformed.getPosition() + b.getText().length());
                }
                break;

            case DELETE:
                int bEnd = b.getPosition() + b.getLength();

                // B deletes entirely before A's position
                if (bEnd <= transformed.getPosition()) {
                    transformed.setPosition(transformed.getPosition() - b.getLength());
                }
                // B deletes a range that includes A's position
                else if (b.getPosition() <= transformed.getPosition() && transformed.getPosition() < bEnd) {
                    transformed.setPosition(b.getPosition());

                    // If A is also a delete/replace, adjust its length if it overlaps with B
                    if ((transformed.getType() == OperationType.DELETE || transformed.getType() == OperationType.REPLACE)
                            && transformed.getLength() != null) {
                        int aEnd = transformed.getPosition() + transformed.getLength();
                        if (aEnd > bEnd) {
                            transformed.setLength(aEnd - bEnd);
                        } else {
                            // A is completely within B's deletion range
                            transformed.setLength(0);
                        }
                    }
                }
                // B deletes a range that overlaps with A's range (for DELETE/REPLACE operations)
                else if ((transformed.getType() == OperationType.DELETE || transformed.getType() == OperationType.REPLACE)
                        && transformed.getLength() != null) {
                    int aEnd = transformed.getPosition() + transformed.getLength();
                    if (transformed.getPosition() < b.getPosition() && b.getPosition() < aEnd) {
                        // B deletes part of A's range
                        transformed.setLength(Math.min(b.getPosition() - transformed.getPosition(), transformed.getLength()));
                    }
                }
                break;

            case REPLACE:
                // For simplicity, treat REPLACE as DELETE followed by INSERT
                // First transform against the delete part
                TextOperation deleteOp = new TextOperation();
                deleteOp.setType(OperationType.DELETE);
                deleteOp.setPosition(b.getPosition());
                deleteOp.setLength(b.getLength());
                deleteOp.setVersion(b.getVersion());
                deleteOp.setUserId(b.getUserId());

                transformed = transformOperation(transformed, deleteOp);

                // Then transform against the insert part
                TextOperation insertOp = new TextOperation();
                insertOp.setType(OperationType.INSERT);
                insertOp.setPosition(b.getPosition());
                insertOp.setText(b.getText());
                insertOp.setVersion(b.getVersion());
                insertOp.setUserId(b.getUserId());

                transformed = transformOperation(transformed, insertOp);
                break;
        }

        return transformed;
    }
}
