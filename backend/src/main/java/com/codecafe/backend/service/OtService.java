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

            // Clone original base vector for concurrency checks and initial validation state
            VersionVector originalBaseVector = (operation.getBaseVersionVector() != null && operation.getBaseVersionVector().getVersions() != null)
                ? new VersionVector(new HashMap<>(operation.getBaseVersionVector().getVersions()))
                : new VersionVector(new HashMap<>());

            // Validate incoming operation structure (e.g., null checks) - modifies the 'operation' object if needed
            validateOperation(operation); // Basic structural validation

            // Find concurrent operations that happened after the client's original base version
            // Pass the original base vector for comparison against history ops' base vectors
            List<TextOperation> concurrentOps = findConcurrentOperations(userId, originalBaseVector);
            logger.info("Found " + concurrentOps.size() + " concurrent operations");

            // Sort concurrent operations deterministically
            sortConcurrentOps(concurrentOps); // Extracted helper method

            // Transform the incoming operation against all concurrent operations
            TextOperation transformedOp = cloneOperation(operation); // Start transformation with a clone of the validated incoming op

            for (TextOperation concurrentOp : concurrentOps) {
                // Transform the operation iteratively
                transformedOp = transformOperation(transformedOp, concurrentOp);
                logger.fine("Transformed against: " + concurrentOp.getId() + ", result: " + transformedOp);
            }

            // Capture the server's version vector state *before* applying the transformed operation
            VersionVector serverVectorBeforeApply = new VersionVector(new HashMap<>(serverVersionVector.getVersions()));

            // Apply the final transformed operation to the document content
            applyOperation(transformedOp); // Modifies documentContent

            // Update the main server version vector reflecting the application of the transformedOp
            Map<String, Integer> newServerVersions = new HashMap<>(serverVectorBeforeApply.getVersions());
            int currentUserVersion = newServerVersions.getOrDefault(userId, 0) + 1; // Increment version for the op's user
            newServerVersions.put(userId, currentUserVersion);
            serverVersionVector = new VersionVector(newServerVersions); // Update the main server vector

            // Prepare the operation representation for storing in history
            TextOperation historyOp = cloneOperation(transformedOp); // Clone the applied operation's details
            historyOp.setBaseVersionVector(serverVectorBeforeApply); // ** CRITICAL: Set base vector to state *before* apply **

            // Add the history operation to the log
            operationHistory.add(historyOp);
            pruneHistory(); // Extracted helper method

            // Prepare the operation to return to the client
            TextOperation returnedOp = cloneOperation(transformedOp); // Clone applied op details again
            returnedOp.setBaseVersionVector(serverVersionVector); // Set vector to the *new* server state

            logger.info("New document state: " + documentContent);
            logger.info("New server version vector: " + serverVersionVector);

            return returnedOp; // Return the applied op with the latest server vector

        } finally {
            lock.unlock();
        }
    }

    /**
     * Find operations that are concurrent with the given operation based on its base vector
     */
    private List<TextOperation> findConcurrentOperations(String incomingUserId, VersionVector clientVector) { // Modified signature
        List<TextOperation> concurrent = new ArrayList<>();
        Map<String, Integer> clientVersions = (clientVector != null && clientVector.getVersions() != null)
                                             ? clientVector.getVersions() : new HashMap<>();

        logger.info("Finding concurrent ops for incoming User " + incomingUserId + " with VV " + clientVector);

        for (TextOperation historyOp : operationHistory) {
            // historyOp.getBaseVersionVector() now correctly represents the server state *before* historyOp was applied

            VersionVector historyBaseVector = historyOp.getBaseVersionVector();
            if (historyBaseVector == null || historyBaseVector.getVersions() == null) {
                 logger.warning("Skipping history operation with null base version vector: " + historyOp.getId());
                 continue;
            }
            Map<String, Integer> historyBaseVersions = historyBaseVector.getVersions();
            String historyOpUserId = historyOp.getUserId(); // User H (author of history op)

            // Get the version of user H *before* historyOp was applied.
            int historyOpBaseVersion = historyBaseVersions.getOrDefault(historyOpUserId, 0);

            // Get the sequence number that historyOp created for user H.
            int historyOpSequenceNumber = historyOpBaseVersion + 1;

            // Get the version of user H as known by the incoming client operation.
            int historyOpUserVersionInClient = clientVersions.getOrDefault(historyOpUserId, 0);

            // Log the values being compared
            logger.fine(String.format("  vs HistOp %s (User %s): ClientKnowsVer(H)=%d, HistOpCreatesVer(H)=%d (HistOpBaseVer(H)=%d)",
                                  historyOp.getId() != null ? historyOp.getId().substring(0, Math.min(8, historyOp.getId().length())) : "N/A", // Short ID
                                  historyOpUserId,
                                  historyOpUserVersionInClient,
                                  historyOpSequenceNumber,
                                  historyOpBaseVersion));

            // Concurrency Check: If the client's knowledge of H is less than the version H *became* after historyOp,
            // then the client didn't know about historyOp.
            if (historyOpUserVersionInClient < historyOpSequenceNumber) {
                logger.fine("   -> CONCURRENT: Client state for User " + historyOpUserId + " (" + historyOpUserVersionInClient + ") < History Op's resulting version (" + historyOpSequenceNumber + ")");
                concurrent.add(historyOp); // Add the actual history op for transformation
            } else {
                 logger.fine("   -> NOT CONCURRENT: Client state for User " + historyOpUserId + " (" + historyOpUserVersionInClient + ") >= History Op's resulting version (" + historyOpSequenceNumber + ")");
            }
        }

        if (!concurrent.isEmpty()) {
            logger.info(" -> Incoming op (User " + incomingUserId + ") will be transformed against " + concurrent.size() + " history operations.");
        } else {
             logger.info(" -> Incoming op (User " + incomingUserId + ") requires no transformation against history.");
        }

        return concurrent;
    }

    /** Sorts operations deterministically: User ID first, then sequence number */
    private void sortConcurrentOps(List<TextOperation> ops) {
         ops.sort((a, b) -> {
            int userCompare = a.getUserId().compareTo(b.getUserId());
            if (userCompare != 0) return userCompare;

            VersionVector aBaseVector = a.getBaseVersionVector();
            VersionVector bBaseVector = b.getBaseVersionVector();
            Map<String, Integer> aVersions = (aBaseVector != null && aBaseVector.getVersions() != null) ? aBaseVector.getVersions() : new HashMap<>();
            Map<String, Integer> bVersions = (bBaseVector != null && bBaseVector.getVersions() != null) ? bBaseVector.getVersions() : new HashMap<>();

            int aBaseVersion = aVersions.getOrDefault(a.getUserId(), 0);
            int bBaseVersion = bVersions.getOrDefault(b.getUserId(), 0);
            // Sort based on the version *created by* the operation: base version + 1
            return Integer.compare(aBaseVersion + 1, bBaseVersion + 1);
        });
    }

    /** Prunes the operation history if it exceeds the maximum size */
    private void pruneHistory() {
        if (operationHistory.size() > MAX_HISTORY_SIZE) {
            // Remove the oldest half of the excess operations
            int removeCount = operationHistory.size() - (MAX_HISTORY_SIZE / 2);
            operationHistory.subList(0, removeCount).clear();
            logger.info("Pruned operation history. New size: " + operationHistory.size());
        }
    }

    /**
     * Apply an operation to the document
     */
    private void applyOperation(TextOperation operation) {
        StringBuilder sb = new StringBuilder(documentContent);
        int docLength = sb.length();

        // Re-validate position just before applying, clamp to bounds
        int position = Math.max(0, operation.getPosition());
        position = Math.min(position, docLength); // Clamp position to [0, docLength]

        String text = operation.getText() != null ? operation.getText().replace("\r\n", "\n") : "";
        int length = operation.getLength() != null ? operation.getLength() : 0;
        if (length < 0) length = 0;

        try {
            switch (operation.getType()) {
                case INSERT:
                    sb.insert(position, text);
                    break;
                case DELETE:
                    int deleteEnd = position + length;
                    // Clamp deleteEnd to docLength
                    deleteEnd = Math.min(deleteEnd, docLength);
                    // Only delete if start position is valid and before end position
                    if (position < deleteEnd) {
                        sb.delete(position, deleteEnd);
                    }
                    break;
                case REPLACE:
                    int replaceEnd = position + length;
                    // Clamp replaceEnd to docLength
                    replaceEnd = Math.min(replaceEnd, docLength);
                    // Only replace if start position is valid and before end position
                    if (position < replaceEnd) {
                        sb.replace(position, replaceEnd, text);
                    } else if (position <= docLength) { // Handle insert-at-end case if length was 0 or invalid
                        sb.insert(position, text);
                    } else {
                        logger.warning("Replace operation could not be applied: position " + position + " >= docLength " + docLength);
                    }
                    break;
            }
            documentContent = sb.toString(); // Assign back the modified content
            logger.fine("Operation applied successfully: " + operation.getType() + " at pos " + position + ", Final doc length: " + documentContent.length());
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error applying operation: " + operation + " to doc state: '" + documentContent + "'", e);
            // Avoid modifying document on error - sb changes are discarded
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