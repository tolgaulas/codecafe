package com.codecafe.backend.controller;

import com.codecafe.backend.dto.UserInfo;
import com.codecafe.backend.dto.UserInfoDTO;
import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.CursorMessage;
import com.codecafe.backend.dto.Position;
import com.codecafe.backend.dto.DocumentState;
import com.codecafe.backend.service.SessionRegistryService;
import com.codecafe.backend.service.OtService;
import com.codecafe.backend.dto.JoinPayload;
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
import java.util.List;
import java.util.Map;

@Controller
public class EditorController {

    private static final Logger log = LoggerFactory.getLogger(EditorController.class);

    // Inject the messaging template and session registry
    private final SimpMessagingTemplate messagingTemplate;
    private final SessionRegistryService sessionRegistryService;
    private final OtService otService;

    @Autowired
    public EditorController(SimpMessagingTemplate messagingTemplate, SessionRegistryService sessionRegistryService, OtService otService) {
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistryService = sessionRegistryService;
        this.otService = otService;
    }

    /**
     * Handles a client explicitly joining a session/document.
     * Registers the user and broadcasts the updated state immediately.
     */
    @MessageMapping("/join")
    public void handleJoin(@Payload JoinPayload payload,
                           SimpMessageHeaderAccessor headerAccessor) {

        String sessionId = payload.getSessionId();
        String documentId = payload.getDocumentId();
        String userId = payload.getUserId();
        String userName = payload.getUserName();
        String userColor = payload.getUserColor();

        log.info("Received join request: {}", payload);

        if (sessionId == null || documentId == null || userId == null || userName == null || userColor == null) {
            log.warn("Invalid join payload received. Missing required fields. Payload: {}", payload);
            // Optionally send an error back to the specific user?
            return;
        }

        // Create UserInfoDTO from payload
        UserInfoDTO userInfoDTO = new UserInfoDTO();
        userInfoDTO.setId(userId);
        userInfoDTO.setName(userName);
        userInfoDTO.setColor(userColor);
        // Initial join doesn't necessarily have cursor/selection
        userInfoDTO.setCursorPosition(null); 
        userInfoDTO.setSelection(null);

        try {
            // Register the user in the specific session/document
            sessionRegistryService.userJoined(sessionId, documentId, userInfoDTO);
            log.info("User [{}] registered in session [{}], doc [{}] via /app/join", userId, sessionId, documentId);

            // Immediately broadcast the updated full state
            broadcastFullDocumentState(sessionId, documentId, userId); 

        } catch (Exception e) {
            log.error("Error processing join request for user [{}] in session [{}], doc [{}]: {}", 
                      userId, sessionId, documentId, e.getMessage(), e);
            // Optionally send an error back?
        }
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

        boolean registryUpdated = false;
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
            registryUpdated = true;
            log.debug("[Session: {}] Updated/Joined user [{}] in registry for doc [{}] due to selection update", sessionId, senderClientId, documentId);
        } catch (Exception e) {
            log.error("[Session: {}] Error updating session registry for user [{}] in doc [{}]: {}", sessionId, senderClientId, documentId, e.getMessage(), e);
        }

        // Construct session-specific broadcast topic
        String selectionDestination = String.format("/topic/sessions/%s/selections/document/%s", sessionId, documentId);

        log.info("Attempting to broadcast selection for session '{}', doc '{}' from client '{}' to {}", sessionId, documentId, senderClientId, selectionDestination);
        try {
             messagingTemplate.convertAndSend(selectionDestination, message);
             log.info("Successfully broadcasted selection update to {} for session '{}', doc '{}'", selectionDestination, sessionId, documentId);
        } catch (Exception e) {
            log.error("Error broadcasting selection update to {} for session '{}', doc '{}'", selectionDestination, sessionId, documentId, e);
        }

        if (registryUpdated) {
            broadcastFullDocumentState(sessionId, documentId, senderClientId);
        }
    }

    private void broadcastFullDocumentState(String sessionId, String documentId, String updatedByClientId) {
        log.info("Broadcasting full document state for session [{}], doc [{}] triggered by user [{}]", sessionId, documentId, updatedByClientId);
        try {
            List<UserInfoDTO> participants = sessionRegistryService.getActiveParticipantsForDocument(sessionId, documentId, null);
            
            String currentContent = otService.getDocumentContent(sessionId, documentId);
            int currentRevision = otService.getRevision(sessionId, documentId);

            DocumentState fullState = new DocumentState();
            fullState.setSessionId(sessionId);
            fullState.setDocumentId(documentId);
            fullState.setDocument(currentContent);
            fullState.setRevision(currentRevision);
            fullState.setParticipants(participants);

            String stateDestination = String.format("/topic/sessions/%s/state/document/%s", sessionId, documentId);
            messagingTemplate.convertAndSend(stateDestination, fullState);
            log.info("Successfully broadcasted full document state to {} for session [{}], doc [{}]", stateDestination, sessionId, documentId);

        } catch (Exception e) {
            log.error("Error broadcasting full document state for session [{}], doc [{}]: {}", sessionId, documentId, e.getMessage(), e);
        }
    }
}