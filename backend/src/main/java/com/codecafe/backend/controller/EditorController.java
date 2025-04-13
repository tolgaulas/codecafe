package com.codecafe.backend.controller;

import com.codecafe.backend.dto.UserInfo;
import com.codecafe.backend.dto.UserInfoDTO;
import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.CursorMessage;
import com.codecafe.backend.dto.Position;
import com.codecafe.backend.service.SessionRegistryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.HashMap;
import java.util.Map;

@Controller
public class EditorController {

    private static final Logger log = LoggerFactory.getLogger(EditorController.class);

    // Inject the messaging template and session registry
    private final SimpMessagingTemplate messagingTemplate;
    private final SessionRegistryService sessionRegistryService;

    @Autowired
    public EditorController(SimpMessagingTemplate messagingTemplate, SessionRegistryService sessionRegistryService) {
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistryService = sessionRegistryService;
    }

    // Endpoint to receive cursor/selection data from a client.
    @MessageMapping("/selection")
    public void handleSelectionUpdate(@Payload CursorMessage message,
                                      SimpMessageHeaderAccessor headerAccessor) {

        // Extract fields and validate
        String sessionId = message.getSessionId();
        String documentId = message.getDocumentId();
        UserInfo senderUserInfo = message.getUserInfo();

        if (sessionId == null || documentId == null || senderUserInfo == null || senderUserInfo.getId() == null) {
            log.warn("Received invalid selection message (missing session, doc, or user info/id): {}", message);
            return;
        }
        String senderClientId = senderUserInfo.getId();

        // Optional: Update SessionRegistryService with user activity/state
        try {
            UserInfoDTO userInfoDTO = new UserInfoDTO();
            userInfoDTO.setId(senderUserInfo.getId());
            userInfoDTO.setName(senderUserInfo.getName());
            userInfoDTO.setColor(senderUserInfo.getColor());
            
            // Convert Position to Map<String, Integer>
            Position cursorPosition = senderUserInfo.getCursorPosition();
            if (cursorPosition != null) {
                Map<String, Integer> cursorPositionMap = new HashMap<>();
                cursorPositionMap.put("lineNumber", cursorPosition.getLineNumber());
                cursorPositionMap.put("column", cursorPosition.getColumn());
                userInfoDTO.setCursorPosition(cursorPositionMap);
            } else {
                userInfoDTO.setCursorPosition(null);
            }
            
            // Assuming UserInfo.getSelection() returns the correct type for UserInfoDTO.setSelection(Object)
            userInfoDTO.setSelection(senderUserInfo.getSelection());
            sessionRegistryService.userJoined(sessionId, documentId, userInfoDTO);
            log.debug("[Session: {}] Updated/Joined user [{}] in registry for doc [{}] due to selection update", sessionId, senderClientId, documentId);
        } catch (Exception e) {
            log.error("[Session: {}] Error updating session registry for user [{}] in doc [{}]: {}", sessionId, senderClientId, documentId, e.getMessage(), e);
        }

        // Construct session-specific broadcast topic
        String destination = String.format("/topic/sessions/%s/selections/document/%s", sessionId, documentId);

        log.info("Attempting to broadcast selection for session '{}', doc '{}' from client '{}' to {}", sessionId, documentId, senderClientId, destination);
        try {
             messagingTemplate.convertAndSend(destination, message);
             log.info("Successfully broadcasted selection update to {} for session '{}', doc '{}'", destination, sessionId, documentId);
        } catch (Exception e) {
            log.error("Error broadcasting selection update to {} for session '{}', doc '{}'", destination, sessionId, documentId, e);
        }
    }
}