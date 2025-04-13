package com.codecafe.backend.listener;

import com.codecafe.backend.dto.DocumentState;
import com.codecafe.backend.dto.UserInfoDTO;
import com.codecafe.backend.service.OtService;
import com.codecafe.backend.service.SessionRegistryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.messaging.MessageHeaders; // Import MessageHeaders

import java.security.Principal;
import java.util.List;
import java.util.Map;

@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final SessionRegistryService sessionRegistryService;
    private final SimpMessagingTemplate messagingTemplate;
    private final OtService otService;

    @Autowired
    public WebSocketEventListener(SessionRegistryService sessionRegistryService,
                                  SimpMessagingTemplate messagingTemplate,
                                  OtService otService) {
        this.sessionRegistryService = sessionRegistryService;
        this.messagingTemplate = messagingTemplate;
        this.otService = otService;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        MessageHeaders headers = event.getMessage().getHeaders();
        Principal userPrincipal = SimpMessageHeaderAccessor.getUser(headers);
        String simpSessionId = SimpMessageHeaderAccessor.getSessionId(headers); // WebSocket session ID

        if (userPrincipal != null) {
            log.info("WebSocket Connected: User={}, WebSocket SessionId={}", userPrincipal.getName(), simpSessionId);
            // TODO: Implement logic to register user immediately upon connection if possible.
            // This is challenging because we might not have sessionId, documentId, name, color yet.
            // Option 1: Client sends a dedicated "join" message right after connect.
            // Option 2: Try to extract info from initial CONNECT headers (if sent by client).
            // Option 3: Defer full registration until first selection/activity message (current approach).
        } else {
             log.warn("WebSocket Connected: No user principal found. WebSocket SessionId={}", simpSessionId);
        }
    }

    @EventListener
    public void handleWebSocketSubscribeListener(SessionSubscribeEvent event) {
        MessageHeaders headers = event.getMessage().getHeaders();
        Principal userPrincipal = SimpMessageHeaderAccessor.getUser(headers);
        String simpSessionId = SimpMessageHeaderAccessor.getSessionId(headers);
        String destination = SimpMessageHeaderAccessor.getDestination(headers);

        if (userPrincipal != null) {
            log.info("WebSocket Subscribed: User={}, WebSocket SessionId={}, Destination={}", userPrincipal.getName(), simpSessionId, destination);
            // TODO: If client sends session/document info during subscription, handle it here.
            // This could be an alternative way to register the user early.
        } else {
            log.warn("WebSocket Subscribed: No user principal found. WebSocket SessionId={}, Destination={}", simpSessionId, destination);
        }
    }


    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
         MessageHeaders headers = event.getMessage().getHeaders();
         Principal userPrincipal = SimpMessageHeaderAccessor.getUser(headers);
         String simpSessionId = SimpMessageHeaderAccessor.getSessionId(headers); // WebSocket session ID

         if (userPrincipal != null) {
            String userId = userPrincipal.getName(); // Assuming principal name is the unique userId
            log.info("WebSocket Disconnected: User={}, WebSocket SessionId={}", userId, simpSessionId);

            // Remove user from registry and get affected session/document pairs
            List<Map.Entry<String, String>> affectedEntries = sessionRegistryService.userLeft(userId);

            // Broadcast updated state for each affected document
            affectedEntries.forEach(entry -> {
                String sessionId = entry.getKey();
                String documentId = entry.getValue();
                log.info("User [{}] left session [{}], doc [{}]. Triggering state broadcast.", userId, sessionId, documentId);
                // Pass userId of the user who left as the trigger user
                broadcastFullDocumentState(sessionId, documentId, userId);
            });

         } else {
            log.warn("WebSocket Disconnected: No user principal found. WebSocket SessionId={}. Cannot clean up registry.", simpSessionId);
         }
    }

    // Helper method to broadcast the full document state 
    // (Adapted from EditorController)
    private void broadcastFullDocumentState(String sessionId, String documentId, String triggerUserId) {
         log.info("Broadcasting full document state for session [{}], doc [{}] triggered by user action (disconnect/activity) of user [{}]", sessionId, documentId, triggerUserId);
         try {
            // Fetch current participants (excluding no one, we want the full list)
            List<UserInfoDTO> participants = sessionRegistryService.getActiveParticipantsForDocument(sessionId, documentId, null);
            
            // Fetch current document content and revision
            String currentContent = otService.getDocumentContent(sessionId, documentId);
            int currentRevision = otService.getRevision(sessionId, documentId);

            // Construct the full state object
            DocumentState fullState = new DocumentState();
            fullState.setSessionId(sessionId); // Ensure this is set
            fullState.setDocumentId(documentId);
            fullState.setDocument(currentContent);
            fullState.setRevision(currentRevision);
            fullState.setParticipants(participants);

            // Send to the specific state topic
            String stateDestination = String.format("/topic/sessions/%s/state/document/%s", sessionId, documentId);
            messagingTemplate.convertAndSend(stateDestination, fullState);
            log.info("Successfully broadcasted full document state to {} for session [{}], doc [{}]", stateDestination, sessionId, documentId);

         } catch (Exception e) {
             log.error("Error broadcasting full document state for session [{}], doc [{}]: {}", sessionId, documentId, e.getMessage(), e);
         }
    }

} 