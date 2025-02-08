package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import org.springframework.stereotype.Service;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.Transaction;
import redis.clients.jedis.exceptions.JedisDataException;

@Service
public class OtService {
    public synchronized TextOperation applyOperation(TextOperation op) {
        try (Jedis jedis = new Jedis("localhost", 6379)) {
            while (true) {
                jedis.watch("doc:content", "doc:version");

                String content = jedis.get("doc:content");
                int currentVersion = Integer.parseInt(jedis.get("doc:version"));

                if (op.getBaseVersion() != currentVersion) {
                    jedis.unwatch();
                    return new TextOperation(currentVersion, content, op.getUserId());
                }

                String newContent = op.getNewText();
                int newVersion = currentVersion + 1;

                Transaction tx = jedis.multi();
                tx.set("doc:content", newContent);
                tx.set("doc:version", String.valueOf(newVersion));
                if (tx.exec() != null) {
                    return new TextOperation(newVersion, newContent, op.getUserId());
                }
            }
        } catch (JedisDataException e) {
            e.printStackTrace();
        }
        return null;
    }
}