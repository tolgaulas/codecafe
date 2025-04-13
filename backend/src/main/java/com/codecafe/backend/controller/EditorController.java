package com.codecafe.backend.controller;

import com.codecafe.backend.dto.UserInfo;
import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.CursorMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class EditorController {

    private static final Logger log = LoggerFactory.getLogger(EditorController.class);

    // Inject the messaging template
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public EditorController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // In-memory storage for user cursor info.
    // private final ConcurrentMap<String, UserInfo> cursorPositions = new ConcurrentHashMap<>();

    // This method handles OT operations (for text changes) as before.
    // For OT, you may already have an endpoint similar to this.
//    @MessageMapping("/ot")
//    @SendTo("/topic/ot")
//    public TextOperation handleOtOperation(@Payload TextOperation op) {
//        // Process the operation—merge, update version, etc.
//        // For the sake of example, simply return the updated op.
//        // (Your existing OT logic goes here)
//        op.setBaseVersion(op.getBaseVersion() + 1);
//        return op;
//    }

    // Endpoint to receive cursor/selection data from a client.
    // Renamed from /cursor to /selection for clarity, matching frontend send destination.
    @MessageMapping("/selection")
    public void handleSelectionUpdate(@Payload CursorMessage message,
                                      SimpMessageHeaderAccessor headerAccessor) {

        // Original validation
        if (message == null || message.getDocumentId() == null || message.getUserInfo() == null) {
            log.warn("Received invalid selection message: {}", message);
            return;
        }

        String documentId = message.getDocumentId();
        String senderClientId = message.getUserInfo().getId(); // Safe now if deserialization works

        log.info("Attempting to broadcast selection for doc '{}' from client '{}' to /topic/selections", documentId, senderClientId);
        try {
             messagingTemplate.convertAndSend("/topic/selections", message);
             log.info("Successfully broadcasted selection update to /topic/selections for doc '{}'", documentId);
        } catch (Exception e) {
            log.error("Error broadcasting selection update to /topic/selections for doc '{}'", documentId, e);
        }
    }
}