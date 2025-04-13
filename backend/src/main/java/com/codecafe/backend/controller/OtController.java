package com.codecafe.backend.controller;

import com.codecafe.backend.dto.DocumentState;
import com.codecafe.backend.dto.IncomingOperationPayload;
import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.service.OtService;
import com.codecafe.backend.dto.IncomingSelectionPayload;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;
import java.security.Principal;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;

@Controller
public class OtController {
    private final OtService otService;
    private final SimpMessagingTemplate messagingTemplate;
    private static final Logger logger = Logger.getLogger(OtController.class.getName());

    public OtController(OtService otService, SimpMessagingTemplate messagingTemplate) {
        this.otService = otService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Handle incoming operations from clients based on ot.js model.
     * Expects a payload containing the client's revision and the operation.
     *
     * @param payload The incoming operation payload.
     * @param headerAccessor Accessor for STOMP headers (e.g., to get session ID).
     * @param principal Optional principal for user identification.
     */
    @MessageMapping("/operation")
    public void handleOperation(@Payload IncomingOperationPayload payload,
                                SimpMessageHeaderAccessor headerAccessor,
                                Principal principal) {

        String clientId = payload.getClientId();
        String documentId = payload.getDocumentId();

        if (clientId == null || documentId == null) {
            logger.warning("Received operation without clientId or documentId in payload. Discarding.");
            return;
        }

        logger.info(String.format("OtController received operation payload from client [%s] for doc [%s]: Revision=%d, Op=%s",
                 clientId, documentId, payload.getRevision(), payload.getOperation()));

        try {
            // Process the operation using the new service method
            // Deserialize List<Object> into TextOperation using the constructor
            TextOperation operation = new TextOperation(payload.getOperation()); 
            TextOperation transformedOp = otService.receiveOperation(documentId, payload.getRevision(), operation);

            // 1. Broadcast the transformed operation to ALL clients
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("documentId", documentId);
            broadcastPayload.put("clientId", clientId);
            broadcastPayload.put("operation", transformedOp.getOps());

            messagingTemplate.convertAndSend("/topic/operations", broadcastPayload);
            logger.fine(String.format("Broadcasted transformed op from client [%s] for doc [%s] to /topic/operations", clientId, documentId));

            // 2. Send ACK back to the original sender ONLY
            String ackDestination = "/topic/ack/" + clientId;
            messagingTemplate.convertAndSend(ackDestination, "ack");
            logger.fine("Sent ACK to client [" + clientId + "] at " + ackDestination);

        } catch (IllegalArgumentException e) {
            logger.warning(String.format("Error processing operation from client [%s] for doc [%s]: %s", clientId, documentId, e.getMessage()));
            // Optionally send an error message back to the client
        } catch (Exception e) {
            logger.severe(String.format("Unexpected error processing operation from client [%s] for doc [%s]: %s", clientId, documentId, e.getMessage()));
            // Handle unexpected errors
        }
    }

    /**
     * Handle selection changes from clients (Optional).
     * Based on ot.js Server/EditorSocketIOServer behavior.
     *
     * @param payload JSON representation of the selection (e.g., { ranges: [{ anchor: number, head: number }] })\n     * @param headerAccessor Accessor for STOMP headers.\n     * @param principal Optional principal.\n     */
    @MessageMapping("/selection")
    public void handleSelection(@Payload IncomingSelectionPayload payload,
                                SimpMessageHeaderAccessor headerAccessor,
                                Principal principal) {

        String clientId = payload.getClientId();
        String documentId = payload.getDocumentId();

        if (clientId == null || documentId == null) {
             logger.warning("Received selection without clientId or documentId in payload.");
             return;
        }

        logger.finest(String.format("Received selection from client [%s] for doc [%s]: %s", clientId, documentId, payload.getSelection()));

        // Broadcast selection to other clients
        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("documentId", documentId);
        broadcastPayload.put("clientId", clientId);
        // Forwarding the raw selection payload - Assuming frontend handles Map<String, List<Map<String, Integer>>>
        broadcastPayload.put("selection", payload.getSelection());

        // Send to the main topic, clients will ignore their own ID
        messagingTemplate.convertAndSend("/topic/selections", broadcastPayload);
         logger.finest(String.format("Broadcasted selection from client [%s] for doc [%s] to /topic/selections", clientId, documentId));
    }

    /**
     * Handle document state requests.
     * Expects a payload containing the documentId.
     * Returns the current document content and revision number for that document.
     */
    @MessageMapping("/get-document-state")
    public void getDocumentState(@Payload Map<String, String> payload) {
        String documentId = payload.get("documentId");

        if (documentId == null) {
            logger.warning("Received get-document-state request without documentId. Ignoring.");
            return;
        }

        logger.info("Received request for document state for doc [" + documentId + "]");

        // Use a Map or a dedicated DTO for the response
        Map<String, Object> stateResponse = new HashMap<>();
        stateResponse.put("documentId", documentId);
        stateResponse.put("document", otService.getDocumentContent(documentId));
        stateResponse.put("revision", otService.getRevision(documentId));

        logger.info("Sending document state: Revision=" + stateResponse.get("revision") + " for doc [" + documentId + "]");
        // Send state back to the requesting client (or broadcast if needed)
        messagingTemplate.convertAndSend("/topic/document-state", stateResponse);
    }
}