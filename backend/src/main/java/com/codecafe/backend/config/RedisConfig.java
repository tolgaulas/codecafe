package com.codecafe.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;

@Configuration
public class RedisConfig {

    @Value("${spring.data.redis.host}")
    private String redisHost;

    @Value("${spring.data.redis.port}")
    private int redisPort;

    @Bean
    public LettuceConnectionFactory lettuceConnectionFactory() {
        RedisStandaloneConfiguration redisStandaloneConfiguration = new RedisStandaloneConfiguration();
        redisStandaloneConfiguration.setHostName(redisHost);
        redisStandaloneConfiguration.setPort(redisPort);
        // No password set for AWS ElastiCache Serverless

        // Configure Lettuce Client with SSL
        LettuceClientConfiguration clientConfig = LettuceClientConfiguration.builder()
                .useSsl() // Enable SSL
                .build();

        LettuceConnectionFactory lettuceConnectionFactory = new LettuceConnectionFactory(redisStandaloneConfiguration, clientConfig);
        lettuceConnectionFactory.afterPropertiesSet(); // Ensure initialization
        return lettuceConnectionFactory;
    }

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
        String luaScript = """
            local contentKey = KEYS[1]
            local historyKey = KEYS[2]
            local newContent = ARGV[1]
            local operationJson = ARGV[2] -- Operation passed as JSON string
            
            redis.call('SET', contentKey, newContent)
            redis.call('RPUSH', historyKey, operationJson) -- Store the JSON string
            
            -- Trim the history list if it exceeds the max size
            local maxHistory = tonumber(ARGV[3])
            if maxHistory and maxHistory > 0 then
                local currentSize = redis.call('LLEN', historyKey)
                if currentSize > maxHistory then
                    redis.call('LTRIM', historyKey, currentSize - maxHistory, -1)
                end
            end

            return true
        """;
        DefaultRedisScript<Boolean> redisScript = new DefaultRedisScript<>();
        redisScript.setScriptText(luaScript);
        redisScript.setResultType(Boolean.class);
        return redisScript;
    }
}