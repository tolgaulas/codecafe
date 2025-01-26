package com.codecafe.backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class WebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    @Autowired
    public WebSocketController(SimpMessagingTemplate messagingTemplate, RedisTemplate<String, Object> redisTemplate) {
        this.messagingTemplate = messagingTemplate;
        this.redisTemplate = redisTemplate;
    }

    @MessageMapping("/message")
    @SendTo("/topic/messages")
    public String broadcastMessage(String message) {
        // Store message in Redis
        redisTemplate.opsForList().rightPush("messages", message);

        // Broadcast message to all clients
        messagingTemplate.convertAndSend("/topic/messages", message);
        return message;
    }
}