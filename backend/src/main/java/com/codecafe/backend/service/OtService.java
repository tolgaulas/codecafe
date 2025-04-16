package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.util.OtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;
import java.util.logging.Logger;
import java.util.logging.Level;

@Service
public class OtService {
    private static final Logger logger = Logger.getLogger(OtService.class.getName());
    private static final int MAX_HISTORY_SIZE_PER_DOC = 5000; 
    private static final String DOC_CONTENT_KEY_PREFIX = "doc:content:";
    private static final String DOC_HISTORY_KEY_PREFIX = "doc:history:";

    // TODO: Replace ReentrantLock with a distributed lock (e.g., using Redisson or Redis SETNX)
    // when scaling beyond a single backend instance. The current lock only prevents races
    // within one instance and is NOT sufficient for multi-instance deployments.
    private final ReentrantLock serviceLock = new ReentrantLock(); // Instance-level lock ONLY
    private final RedisTemplate<String, Object> redisTemplate;
    private final ValueOperations<String, Object> valueOperations; // For document content (String)
    private final ListOperations<String, Object> listOperations;
    private final RedisScript<Boolean> updateContentAndHistoryScript;

    @Autowired
    public OtService(RedisTemplate<String, Object> redisTemplate,
                     RedisScript<Boolean> updateContentAndHistoryScript) {
        this.redisTemplate = redisTemplate;
        this.valueOperations = redisTemplate.opsForValue();
        this.listOperations = redisTemplate.opsForList();
        this.updateContentAndHistoryScript = updateContentAndHistoryScript;
    }

    private String getContentKey(String sessionId, String documentId) {
        return DOC_CONTENT_KEY_PREFIX + sessionId + ":" + documentId;
    }

    private String getHistoryKey(String sessionId, String documentId) {
        return DOC_HISTORY_KEY_PREFIX + sessionId + ":" + documentId;
    }

    /**
     * Gets the current content for a specific document from Redis.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @return The content of the document, or empty string if not found.
     */
    public String getDocumentContent(String sessionId, String documentId) {
        String contentKey = getContentKey(sessionId, documentId);
        try {
            Object content = valueOperations.get(contentKey);
            return (content instanceof String) ? (String) content : "";
        } catch (Exception e) {
            logger.log(Level.SEVERE, String.format("Redis error getting content for key [%s]: %s", contentKey, e.getMessage()), e);
            return "";
        }
    }

    /**
     * Gets the current server revision number (size of history list) from Redis.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @return The revision number for the document (0 if history list doesn't exist).
     */
    public int getRevision(String sessionId, String documentId) {
        String historyKey = getHistoryKey(sessionId, documentId);
        try {
            Long size = listOperations.size(historyKey);
            return (size != null) ? size.intValue() : 0;
        } catch (Exception e) {
             logger.log(Level.SEVERE, String.format("Redis error getting size for key [%s]: %s", historyKey, e.getMessage()), e);
             return 0;
        }
    }

    /**
     * Process an incoming operation from a client against a specified revision for a specific document using Redis state.
     * Transforms the operation against concurrent operations, applies it, updates Redis, and adds it to the history list in Redis.
     * NOTE: Updates to content and history are NOT atomic across Redis keys without using MULTI/EXEC or Lua scripts.
     * The instance-level lock prevents races within this single instance, but not across multiple instances.
     *
     * @param sessionId      The identifier of the session.
     * @param documentId     The identifier of the document being modified.
     * @param clientRevision The revision number the client based their operation on.
     * @param operation      The operation from the client.
     * @return The transformed operation that was applied.
     * @throws IllegalArgumentException if the clientRevision is invalid or transformation/application fails.
     */
    public TextOperation receiveOperation(String sessionId, String documentId, int clientRevision, TextOperation operation) throws IllegalArgumentException {
        // TODO: Replace this instance-level lock with a distributed lock before scaling!
        serviceLock.lock(); // Using instance lock for simplicity
        String contentKey = getContentKey(sessionId, documentId);
        String historyKey = getHistoryKey(sessionId, documentId);
        try {
            String currentContent = getDocumentContent(sessionId, documentId);
            int serverRevision = getRevision(sessionId, documentId);

            logger.info(String.format("[Session: %s, Doc: %s] Received op based on client rev %d (Server rev: %d). Op: %s",
                    sessionId, documentId, clientRevision, serverRevision, operation));

            if (clientRevision < 0 || clientRevision > serverRevision) {
                throw new IllegalArgumentException(
                        String.format("[Session: %s, Doc: %s] Invalid client revision: %d. Server revision is: %d.", sessionId, documentId, clientRevision, serverRevision)
                );
            }

            List<TextOperation> concurrentOps = new ArrayList<>();
            if (clientRevision < serverRevision) {
                 try {
                     List<Object> rawOps = listOperations.range(historyKey, clientRevision, serverRevision - 1);
                     if (rawOps != null) {
                         for (Object rawOp : rawOps) {
                             if (rawOp instanceof TextOperation) {
                                concurrentOps.add((TextOperation) rawOp);
                             } else {
                                 logger.warning(String.format("[Session: %s, Doc: %s] Expected TextOperation in history list [%s] at index >= %d, but got %s",
                                        sessionId, documentId, historyKey, clientRevision, rawOp != null ? rawOp.getClass().getName() : "null"));
                                 throw new IllegalStateException("Invalid object type found in Redis history list for key: " + historyKey);
                             }
                         }
                     }
                 } catch (Exception e) {
                     logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Redis error getting concurrent ops (rev %d to %d) for key [%s]: %s",
                             sessionId, documentId, clientRevision, serverRevision -1, historyKey, e.getMessage()), e);
                     throw new RuntimeException("Failed to retrieve concurrent operations from Redis history.", e);
                 }
            }
            logger.fine(String.format("[Session: %s, Doc: %s] Found %d concurrent operations in Redis history to transform against.", sessionId, documentId, concurrentOps.size()));

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

            String newContent;
            try {
                 logger.info(String.format("[Session: %s, Doc: %s] Attempting to apply op [Rev %d]: %s to current doc content (length %d): '%s'",
                          sessionId, documentId, serverRevision, transformedOp, currentContent.length(), currentContent));
                 newContent = OtUtils.apply(currentContent, transformedOp);
                 logger.fine(String.format("[Session: %s, Doc: %s] Applied transformed operation. New doc length: %d", sessionId, documentId, newContent.length()));
                 logger.finest(String.format("[Session: %s, Doc: %s] New document content snippet: %s", sessionId, documentId, (newContent.length() > 100 ? newContent.substring(0, 100) + "..." : newContent)));
            } catch (Exception e) {
                  logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Error applying transformed operation: %s to doc state: '%s'", sessionId, documentId, transformedOp, currentContent), e);
                  throw new IllegalArgumentException("Apply failed: " + e.getMessage(), e);
            }

            try {
                 List<String> keys = List.of(contentKey, historyKey);
                 Boolean scriptResult = redisTemplate.execute(updateContentAndHistoryScript, keys, newContent, transformedOp);

                 if (Boolean.TRUE.equals(scriptResult)) {
                    logger.fine(String.format("[Session: %s, Doc: %s] Atomically updated Redis content key [%s] and pushed op to history key [%s] via Lua script. New server revision: %d",
                            sessionId, documentId, contentKey, historyKey, serverRevision + 1));
                 } else {
                     logger.severe(String.format("[Session: %s, Doc: %s] Lua script execution for keys [%s, %s] returned false or null. State might be inconsistent!",
                            sessionId, documentId, contentKey, historyKey));
                     throw new RuntimeException("Lua script execution failed to update Redis state.");
                 }
            } catch (Exception e) {
                 logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Redis error executing Lua script for keys [%s, %s]: %s. State might be inconsistent!",
                        sessionId, documentId, contentKey, historyKey, e.getMessage()), e);
                 throw new RuntimeException("Failed to execute Lua script to update Redis state.", e);
            }

            pruneHistory(sessionId, documentId);

            return transformedOp;

        } finally {
            serviceLock.unlock();
        }
    }

    /** Prunes the operation history list in Redis for a specific document if it exceeds the maximum size */
    private void pruneHistory(String sessionId, String documentId) {
        String historyKey = getHistoryKey(sessionId, documentId);
        try {
            Long currentSize = listOperations.size(historyKey);
            if (currentSize != null && currentSize > MAX_HISTORY_SIZE_PER_DOC) {
                 long keepCount = MAX_HISTORY_SIZE_PER_DOC / 2;
                 long startIndex = -keepCount;
                 long endIndex = -1;

                 listOperations.trim(historyKey, startIndex, endIndex);
                 long removedCount = currentSize - keepCount;

                 logger.info(String.format("[Session: %s, Doc: %s] Pruned Redis history list [%s]. Removed approx %d ops. Aiming for size ~%d",
                         sessionId, documentId, historyKey, removedCount, keepCount));
            }
        } catch (Exception e) {
            logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Redis error pruning history list [%s]: %s",
                    sessionId, documentId, historyKey, e.getMessage()), e);
        }
    }

    /**
     * Sets the document content directly in Redis and clears its history list.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @param content The new document content.
     */
    public void setDocumentContent(String sessionId, String documentId, String content) {
        serviceLock.lock();
        String contentKey = getContentKey(sessionId, documentId);
        String historyKey = getHistoryKey(sessionId, documentId);
        try {
            valueOperations.set(contentKey, (content != null) ? content : "");
            redisTemplate.delete(historyKey);
            logger.info(String.format("[Session: %s, Doc: %s] Document content set directly in Redis key [%s]. History list [%s] deleted. New revision: 0",
                     sessionId, documentId, contentKey, historyKey));
        } catch (Exception e) {
              logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Redis error setting content [%s] or deleting history [%s]: %s",
                     sessionId, documentId, contentKey, historyKey, e.getMessage()), e);
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Resets the state (content and history) for a specific document in Redis.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document to reset.
     */
    public void resetSessionDocument(String sessionId, String documentId) {
        serviceLock.lock();
        String contentKey = getContentKey(sessionId, documentId);
        String historyKey = getHistoryKey(sessionId, documentId);
        List<String> keysToDelete = List.of(contentKey, historyKey);
        try {
             Long deletedCount = redisTemplate.delete(keysToDelete);
             if (deletedCount != null && deletedCount > 0) {
                logger.info(String.format("[Session: %s, Doc: %s] Document state reset in Redis. Deleted keys: %s",
                         sessionId, documentId, keysToDelete));
             } else {
                  logger.warning(String.format("[Session: %s, Doc: %s] Attempted to reset non-existent document state in Redis. Keys not found: %s",
                          sessionId, documentId, keysToDelete));
             }
        } catch (Exception e) {
              logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Redis error deleting keys %s: %s",
                     sessionId, documentId, keysToDelete, e.getMessage()), e);
        } finally {
            serviceLock.unlock();
        }
    }

    /**
     * Gets a copy of the operation history (List<TextOperation>) from the Redis list.
     * @param sessionId The identifier of the session.
     * @param documentId The identifier of the document.
     * @return A list of all operations in the document's history, or an empty list if not found or on error.
     */
    public List<TextOperation> getOperationHistory(String sessionId, String documentId) {
        String historyKey = getHistoryKey(sessionId, documentId);
        try {
            List<Object> rawOps = listOperations.range(historyKey, 0, -1);
            if (rawOps != null) {
                List<TextOperation> history = new ArrayList<>(rawOps.size());
                for (Object rawOp : rawOps) {
                     if (rawOp instanceof TextOperation) {
                        history.add((TextOperation) rawOp);
                     } else {
                         logger.warning(String.format("[Session: %s, Doc: %s] Expected TextOperation in history list [%s], but got %s during full history fetch",
                                sessionId, documentId, historyKey, rawOp != null ? rawOp.getClass().getName() : "null"));
                     }
                }
                return history;
            } else {
                return Collections.emptyList();
            }
        } catch (Exception e) {
            logger.log(Level.SEVERE, String.format("[Session: %s, Doc: %s] Redis error getting full history for key [%s]: %s",
                    sessionId, documentId, historyKey, e.getMessage()), e);
            return Collections.emptyList();
        }
    }
}