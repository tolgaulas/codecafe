package com.codecafe.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // Serializer for regular keys
        template.setKeySerializer(new StringRedisSerializer());
        // Serializer for regular values
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());

        // Serializer for hash keys (usually Strings)
        template.setHashKeySerializer(new StringRedisSerializer());
        // Serializer for hash values (needs to be JSON for UserInfoDTO)
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());

        template.afterPropertiesSet(); // Ensure properties are set
        return template;
    }

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(connectionFactory);
        return template;
    }

    // Bean for the Lua script to atomically update content and history
    @Bean
    public RedisScript<Boolean> updateContentAndHistoryScript() {
        // Option 1: Load script from file (Recommended)
        // DefaultRedisScript<Boolean> redisScript = new DefaultRedisScript<>();
        // redisScript.setLocation(new ClassPathResource("scripts/updateContentAndHistory.lua"));
        // redisScript.setResultType(Boolean.class);
        // return redisScript;

        // Option 2: Inline script text (Simpler for short scripts)
        String luaScript = """
            local contentKey = KEYS[1]
            local historyKey = KEYS[2]
            local newContent = ARGV[1]
            local operation = ARGV[2]
            
            redis.call('SET', contentKey, newContent)
            redis.call('RPUSH', historyKey, operation)
            return true
        """;
        DefaultRedisScript<Boolean> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(luaScript);
        redisScript.setResultType(Boolean.class);
        return redisScript;
    }
}