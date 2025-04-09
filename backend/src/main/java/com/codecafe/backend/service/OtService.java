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
import java.util.logging.Level;

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

            // Validate incoming operation before processing
            validateOperation(operation);

            // Handle case of null version vector
            if (operation.getBaseVersionVector() == null || operation.getBaseVersionVector().getVersions() == null) {
                VersionVector initialVector = new VersionVector(new HashMap<>());
                operation.setBaseVersionVector(initialVector);
            }

            // Find concurrent operations that happened after the client's base version
            List<TextOperation> concurrentOps = findConcurrentOperations(operation);
            logger.info("Found " + concurrentOps.size() + " concurrent operations");

            // Sort operations deterministically
            concurrentOps.sort((a, b) -> {
                int userCompare = a.getUserId().compareTo(b.getUserId());
                if (userCompare != 0) return userCompare;
                
                Map<String, Integer> aVersions = a.getBaseVersionVector().getVersions();
                Map<String, Integer> bVersions = b.getBaseVersionVector().getVersions();
                int aVersion = aVersions.getOrDefault(a.getUserId(), 0);
                int bVersion = bVersions.getOrDefault(b.getUserId(), 0);
                return Integer.compare(aVersion, bVersion);
            });

            // Transform operation against all concurrent operations
            TextOperation transformedOp = cloneOperation(operation);
            StringBuilder tempDoc = new StringBuilder(documentContent);
            
            for (TextOperation concurrentOp : concurrentOps) {
                // Transform the operation
                transformedOp = transformOperation(transformedOp, concurrentOp);
                logger.fine("Transformed against: " + concurrentOp.getId() + ", result: " + transformedOp);
            }

            // Validate the transformed operation against current document state
            validateOperation(transformedOp);

            // Apply the operation to the document
            applyOperation(transformedOp);

            // Update version vector
            Map<String, Integer> newVersions = new HashMap<>(serverVersionVector.getVersions());
            int userVersion = newVersions.getOrDefault(userId, 0) + 1;
            newVersions.put(userId, userVersion);
            serverVersionVector = new VersionVector(newVersions);
            transformedOp.setBaseVersionVector(new VersionVector(newVersions));

            // Add to history with pruning
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
        Map<String, Integer> clientVersions = (clientVector != null && clientVector.getVersions() != null) 
                                             ? clientVector.getVersions() : new HashMap<>();

        logger.info("Finding concurrent ops for incoming " + operation.getId() + " (User " + operation.getUserId() + ") with VV " + clientVector);


        for (TextOperation historyOp : operationHistory) {
            // Don't transform an operation against itself if it somehow appears in history
            // (e.g., reprocessing or specific server logic). Primarily, VV handles this.
            if (operation.getId() != null && operation.getId().equals(historyOp.getId()) &&
                operation.getUserId().equals(historyOp.getUserId())) {
                 logger.fine(" - Skipping history op " + historyOp.getId() + " (matches incoming op)");
                 continue;
            }

            VersionVector historyVector = historyOp.getBaseVersionVector();
            if (historyVector == null || historyVector.getVersions() == null) {
                 logger.warning("Skipping history operation with null version vector: " + historyOp.getId());
                 continue; // Skip ops with invalid vectors
            }
            Map<String, Integer> historyVersions = historyVector.getVersions();
            String historyOpUserId = historyOp.getUserId();

            // Get the version of the history op's user *when the history op was created*
            int historyOpUserVersionAtCreation = historyVersions.getOrDefault(historyOpUserId, 0);

            // Get the version of the history op's user as known by the *incoming operation's base state*
            int historyOpUserVersionInClient = clientVersions.getOrDefault(historyOpUserId, 0);

            // If the incoming client operation's state knows a version for the history op's user
            // that is strictly less than the version *after* the history op would have been applied (creation version + 1),
            // it means the client created its operation without knowledge of this history operation.
            // Thus, the client's operation needs to be transformed against this history operation.
            if (historyOpUserVersionInClient < historyOpUserVersionAtCreation + 1) {
                logger.fine(" -> Found concurrent history op " + historyOp.getId() + " (User " + historyOpUserId + ", created after ver " + historyOpUserVersionAtCreation + ")");
                logger.fine("    Incoming op VV knows User " + historyOpUserId + " state: " + historyOpUserVersionInClient);
                concurrent.add(historyOp); // Add the original history op for transformation
            } else {
                 logger.fine(" - Skipping history op " + historyOp.getId() + " (User " + historyOpUserId + ", created after ver " + historyOpUserVersionAtCreation + "). Incoming op VV knows state " + historyOpUserVersionInClient);
            }
        }

        // Sort the identified concurrent history operations for deterministic transformation order.
        // Sort by user ID, then by the operation's effective sequence number (base version + 1) for that user.
        concurrent.sort((a, b) -> {
            int userCompare = a.getUserId().compareTo(b.getUserId());
            if (userCompare != 0) return userCompare;

            // Use baseVersionVector for sorting
            Map<String, Integer> aVersions = a.getBaseVersionVector() != null ? a.getBaseVersionVector().getVersions() : new HashMap<>();
            Map<String, Integer> bVersions = b.getBaseVersionVector() != null ? b.getBaseVersionVector().getVersions() : new HashMap<>();
            int aVersion = aVersions.getOrDefault(a.getUserId(), 0);
            int bVersion = bVersions.getOrDefault(b.getUserId(), 0);
            // Sort based on the version *after* the operation: base version + 1
            return Integer.compare(aVersion + 1, bVersion + 1);
        });


        if (!concurrent.isEmpty()) {
            logger.info(" -> Incoming op " + operation.getId() + " (User " + operation.getUserId() + ") will be transformed against " + concurrent.size() + " history operations: [" + concurrent.stream().map(TextOperation::getId).reduce((acc, id) -> acc + ", " + id).orElse("") + "]");
        } else {
             logger.info(" -> Incoming op " + operation.getId() + " (User " + operation.getUserId() + ") requires no transformation against history.");
        }

        return concurrent;
    }

    /**
     * Apply an operation to the document
     */
    private void applyOperation(TextOperation operation) {
        StringBuilder sb = new StringBuilder(documentContent);
        int docLength = sb.length();

        // Ensure operation position is validated (should be done before apply)
        // validateOperation(operation); // Validation should happen *before* transformation usually

        // Re-validate position just before applying
        if (operation.getPosition() < 0) operation.setPosition(0);
        if (operation.getPosition() > docLength) operation.setPosition(docLength);

        String text = operation.getText() != null ? operation.getText().replace("\r\n", "\n") : "";
        operation.setText(text); // Ensure normalized text is set back
        int length = operation.getLength() != null ? operation.getLength() : 0;
        if (length < 0) length = 0;

        try {
            switch (operation.getType()) {
                case INSERT:
                    sb.insert(operation.getPosition(), text);
                    break;
                case DELETE:
                    int deleteEnd = operation.getPosition() + length;
                    if (deleteEnd > docLength) {
                        deleteEnd = docLength;
                    }
                    // Only delete if start position is valid and before end position
                    if (operation.getPosition() < deleteEnd) {
                        sb.delete(operation.getPosition(), deleteEnd);
                    }
                    break;
                case REPLACE:
                    // Treat Replace with length 0 as an Insert
                    if (length == 0) {
                         sb.insert(operation.getPosition(), text);
                    } else {
                        int replaceEnd = operation.getPosition() + length;
                        if (replaceEnd > docLength) {
                            replaceEnd = docLength;
                        }
                        // Only replace if start position is valid and before end position
                        if (operation.getPosition() < replaceEnd) {
                           sb.replace(operation.getPosition(), replaceEnd, text);
                        }
                         // If replace position is at the end and length > 0, it might mean append
                         else if (operation.getPosition() == docLength && length > 0) {
                            // This case indicates deletion beyond bounds, effectively a no-op for deletion part.
                            // We still might need to insert the text if specified.
                            // However, standard OT Replace implies replacing existing content.
                            // Let's log a warning if this edge case is hit unexpectedly.
                             logger.warning("Replace operation attempted beyond document bounds, applying as insert at end.");
                             sb.insert(operation.getPosition(), text);
                         } else if (operation.getPosition() == docLength && length == 0) {
                             // This is an insert at the end handled above.
                              sb.insert(operation.getPosition(), text);
                         }
                    }
                    break;
            }
            documentContent = sb.toString();
            logger.fine("Operation applied successfully: " + operation.getType() + " at pos " + operation.getPosition());
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error applying operation: " + operation + " to doc state: '" + documentContent + "'", e);
            // Avoid modifying document on error
        }
    }

    /**
     * Transform operation A against operation B
     */
    private TextOperation transformOperation(TextOperation clientOp, TextOperation serverOp) {
        TextOperation transformed = cloneOperation(clientOp);

        // No need to transform if same op ID or same user (usually handled by version vectors)
        if ((clientOp.getId() != null && clientOp.getId().equals(serverOp.getId())) || 
            clientOp.getUserId().equals(serverOp.getUserId())) {
            // Although same user ops shouldn't be concurrent if VV logic is correct,
            // this adds safety. Should primarily rely on VV checks before calling transform.
             logger.fine("Skipping transformation for same operation ID or user ID.");
            return transformed;
        }

        final int clientPos = transformed.getPosition();
        final int clientLen = transformed.getLength() != null ? transformed.getLength() : 0;
        final String clientText = transformed.getText() != null ? transformed.getText() : "";

        final int serverPos = serverOp.getPosition();
        final int serverLen = serverOp.getLength() != null ? serverOp.getLength() : 0;
        final String serverText = serverOp.getText() != null ? serverOp.getText() : "";

        // --- Transformation Logic --- 

        switch (clientOp.getType()) {
            case INSERT:
                switch (serverOp.getType()) {
                    case INSERT:
                        transformed.setPosition(transformPositionForInsert(clientPos, serverPos, serverText.length(), clientOp.getUserId(), serverOp.getUserId()));
                        break;
                    case DELETE:
                        // If client insert is within or after server delete, adjust position
                        transformed.setPosition(transformPositionForDelete(clientPos, serverPos, serverLen));
                        break;
                    case REPLACE:
                        // Treat server Replace as Delete then Insert
                        TextOperation deletePart = new TextOperation(); // Use default constructor
                        deletePart.setType(OperationType.DELETE);
                        deletePart.setPosition(serverPos);
                        deletePart.setLength(serverLen);
                        deletePart.setBaseVersionVector(serverOp.getBaseVersionVector());
                        deletePart.setUserId(serverOp.getUserId());

                        TextOperation insertPart = new TextOperation(); // Use default constructor
                        insertPart.setType(OperationType.INSERT);
                        insertPart.setPosition(serverPos);
                        insertPart.setText(serverText);
                        insertPart.setBaseVersionVector(serverOp.getBaseVersionVector());
                        insertPart.setUserId(serverOp.getUserId());

                        TextOperation temp = transformOperation(transformed, deletePart);
                        transformed = transformOperation(temp, insertPart);
                        break;
                }
                break;

            case DELETE:
                 switch (serverOp.getType()) {
                    case INSERT:
                        // Adjust delete position based on server insert
                        transformed.setPosition(transformPositionForInsert(clientPos, serverPos, serverText.length(), clientOp.getUserId(), serverOp.getUserId()));
                        // Adjust delete length if server insert happened inside the deleted range
                        transformed.setLength(transformLengthForInsert(clientPos, clientLen, serverPos, serverText.length()));
                        break;
                    case DELETE:
                         // Adjust position based on server delete
                        transformed.setPosition(transformPositionForDelete(clientPos, serverPos, serverLen));
                         // Adjust length based on overlap with server delete
                        transformed.setLength(transformLengthForDelete(clientPos, clientLen, serverPos, serverLen));
                        break;
                    case REPLACE:
                        // Treat server Replace as Delete then Insert
                        TextOperation deletePart = new TextOperation(); // Use default constructor
                        deletePart.setType(OperationType.DELETE);
                        deletePart.setPosition(serverPos);
                        deletePart.setLength(serverLen);
                        deletePart.setBaseVersionVector(serverOp.getBaseVersionVector());
                        deletePart.setUserId(serverOp.getUserId());

                        TextOperation insertPart = new TextOperation(); // Use default constructor
                        insertPart.setType(OperationType.INSERT);
                        insertPart.setPosition(serverPos);
                        insertPart.setText(serverText);
                        insertPart.setBaseVersionVector(serverOp.getBaseVersionVector());
                        insertPart.setUserId(serverOp.getUserId());

                        TextOperation temp = transformOperation(transformed, deletePart);
                        transformed = transformOperation(temp, insertPart);
                        break;
                }
                // If length becomes 0, it might become a no-op
                if (transformed.getLength() != null && transformed.getLength() <= 0) {
                    transformed.setLength(0);
                    // Consider changing type to NOOP or handling differently if needed
                }
                break;

            case REPLACE:
                // Decompose client Replace into Delete + Insert and transform both
                 TextOperation clientDeletePart = new TextOperation(); // Use default constructor
                 clientDeletePart.setId(clientOp.getId() != null ? clientOp.getId() + "-del" : null);
                 clientDeletePart.setType(OperationType.DELETE);
                 clientDeletePart.setPosition(clientPos);
                 clientDeletePart.setLength(clientLen);
                 clientDeletePart.setBaseVersionVector(clientOp.getBaseVersionVector());
                 clientDeletePart.setUserId(clientOp.getUserId());
                 
                 TextOperation clientInsertPart = new TextOperation(); // Use default constructor
                 clientInsertPart.setId(clientOp.getId() != null ? clientOp.getId() + "-ins" : null);
                 clientInsertPart.setType(OperationType.INSERT);
                 clientInsertPart.setPosition(clientPos);
                 clientInsertPart.setText(clientText);
                 clientInsertPart.setBaseVersionVector(clientOp.getBaseVersionVector());
                 clientInsertPart.setUserId(clientOp.getUserId());

                // Transform delete part against server op
                TextOperation transformedDelete = transformOperation(clientDeletePart, serverOp);
                // Transform insert part against server op
                TextOperation transformedInsert = transformOperation(clientInsertPart, serverOp);

                // Reconstruct the transformed Replace operation
                transformed.setPosition(transformedDelete.getPosition());
                transformed.setLength(transformedDelete.getLength());
                transformed.setText(transformedInsert.getText());
                // The insert position might differ if tie-breaking occurred, adjust final position
                if (transformedInsert.getPosition() != transformedDelete.getPosition()) {
                    // This implies the insert part was shifted relative to the delete start.
                    // The effective position of the replace should usually be the start of the transformed delete.
                    // However, if the insert text ends up elsewhere, it's complex.
                    // For simplicity, let's use the transformed delete position and length, and the transformed insert text.
                    // This follows common OT patterns but might need refinement for very complex edge cases.
                    logger.fine("Replace transformation resulted in different delete/insert positions. Using delete position.");
                }
                 // If length becomes 0, it's an Insert
                if (transformed.getLength() != null && transformed.getLength() <= 0) {
                    transformed.setType(OperationType.INSERT);
                    transformed.setLength(null);
                    transformed.setPosition(transformedInsert.getPosition()); // Use insert position if length is 0
                }
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
     * Transform a length based on an insert operation
     * Only relevant when transforming a DELETE or REPLACE against an INSERT.
     * @param opPos Position of the operation being transformed (Delete/Replace)
     * @param opLen Length of the operation being transformed
     * @param insertPos Position of the concurrent insert
     * @param insertLen Length of the concurrent insert
     * @return The transformed length
     */
    private int transformLengthForInsert(int opPos, int opLen, int insertPos, int insertLen) {
        // If insert happens before or at the start of the op, the length doesn't change, only position does.
        if (insertPos <= opPos) {
            return opLen;
        }
        // If insert happens strictly within the op's range
        else if (insertPos > opPos && insertPos < opPos + opLen) {
            return opLen + insertLen;
        }
        // If insert happens after the op, length doesn't change.
        else {
            return opLen;
        }
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
        int docLength = documentContent.length();

        if (operation.getPosition() < 0) {
            operation.setPosition(0);
            logger.warning("Adjusted negative position to 0");
        }

        if (operation.getPosition() > docLength) {
            operation.setPosition(docLength);
            logger.warning("Adjusted out-of-bounds position to document length: " + docLength);
        }

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

        if (operation.getType() == OperationType.INSERT || operation.getType() == OperationType.REPLACE) {
            if (operation.getText() == null) {
                operation.setText("");
                logger.warning("Set null text to empty string");
            }
        }

        // Ensure base version vector exists
        if (operation.getBaseVersionVector() == null || operation.getBaseVersionVector().getVersions() == null) {
            operation.setBaseVersionVector(new VersionVector(new HashMap<>()));
            logger.warning("Created missing base version vector");
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