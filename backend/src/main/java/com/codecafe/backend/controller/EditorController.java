package com.codecafe.backend.controller;

import com.codecafe.backend.dto.UserInfo;
import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.CursorMessage;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.Collection;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;


@Controller
public class EditorController {

    // In-memory storage for user cursor info.
    // (In production you could use Redis here to share across instances.)
    private final ConcurrentMap<String, UserInfo> cursorPositions = new ConcurrentHashMap<>();

    // This method handles OT operations (for text changes) as before.
    // For OT, you may already have an endpoint similar to this.
    @MessageMapping("/ot")
    @SendTo("/topic/ot")
    public TextOperation handleOtOperation(@Payload TextOperation op) {
        // Process the operation—merge, update version, etc.
        // For the sake of example, simply return the updated op.
        // (Your existing OT logic goes here)
        op.setBaseVersion(op.getBaseVersion() + 1);
        return op;
    }

    // New endpoint to receive cursor data from a client.
    @MessageMapping("/cursor")
    @SendTo("/topic/cursors")
    public Collection<UserInfo> handleCursorUpdate(@Payload CursorMessage message,
                                                   SimpMessageHeaderAccessor headerAccessor) {
        // Use the session id or a provided userId to uniquely index this user's info.
        String sessionId = headerAccessor.getSessionId();
        // You can also use an assigned user id if available.
        UserInfo user = message.getUser();
        cursorPositions.put(sessionId, user);
        // Broadcast all cursor infos to all clients.
        return cursorPositions.values();
    }
}