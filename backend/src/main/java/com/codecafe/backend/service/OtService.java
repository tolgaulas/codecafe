package com.codecafe.backend.service;

import com.codecafe.backend.dto.OtOperation;
import org.springframework.stereotype.Service;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.Transaction;
import redis.clients.jedis.exceptions.JedisDataException;

@Service
public class OtService {

    // Transform logic: if there's a mismatch in version, you need to re-fetch, 
    // transform your operation, and re-apply. For brevity, we'll just show naive logic.

    // In a real environment, you'd do more complex transformations if a mismatch is detected.
    public synchronized String applyOperation(OtOperation op) {
        try (Jedis jedis = new Jedis("localhost", 6379)) {
            while (true) {
                // 1) WATCH relevant keys
                jedis.watch("doc:content", "doc:version");

                // 2) Fetch current doc content and version
                String content = jedis.get("doc:content");
                int currentVersion = Integer.parseInt(jedis.get("doc:version"));

                // 3) Check if version has changed
                if (op.getBaseVersion() != currentVersion) {
                    // Real-world: transform operation here or handle conflict
                    System.out.println("[OT] Version mismatch: reloading doc");
                    // For simplicity, just reject or ignore. 
                    // Or re-fetch and recalculate positions, etc.
                    jedis.unwatch();
                    return content;  
                }

                // 4) Apply the operation to the content
                StringBuilder sb = new StringBuilder(content);

                // Example: delete text, then insert new text
                if (op.getDeleteCount() > 0) {
                    int end = Math.min(op.getPosition() + op.getDeleteCount(), sb.length());
                    sb.delete(op.getPosition(), end);
                }
                if (op.getInsertedText() != null) {
                    sb.insert(op.getPosition(), op.getInsertedText());
                }

                // 5) Prepare new content + version
                String newContent = sb.toString();
                int newVersion = currentVersion + 1;

                // 6) MULTI/EXEC to store updated doc
                Transaction tx = jedis.multi();
                tx.set("doc:content", newContent);
                tx.set("doc:version", String.valueOf(newVersion));
                // The commands in this transaction succeed only if 
                // the watched keys haven't changed.
                if (tx.exec() != null) {
                    // 7) Publish operation for other clients
                    jedis.publish("doc:channel", "Operation " + op + " -> newVersion: " + newVersion);
                    return newContent;
                }
                // If exec() returns null, the watched keys changed -> loop and try again
            }
        } catch (JedisDataException e) {
            e.printStackTrace();
        }
        return null;
    }
}