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
        if (clientId == null) {
            logger.warning("Received operation without clientId in payload. Discarding.");
            return;
        }

        logger.info("OtController received operation payload from client [" + clientId + "]: Revision=" + payload.getRevision() + ", Op=" + payload.getOperation());

        try {
            // Process the operation using the new service method
            TextOperation transformedOp = otService.receiveOperation(payload.getRevision(), payload.getOperation());

            // 1. Broadcast the transformed operation to ALL clients (including sender)
            // The client state machine needs this broadcast to potentially transform its buffer.
            // The broadcast payload should include the clientId and the operation.
            Map<String, Object> broadcastPayload = new HashMap<>();
            broadcastPayload.put("clientId", clientId);
            broadcastPayload.put("operation", transformedOp.getOps()); // Send raw ops list
            // Note: We don't send revision here; clients track their own based on received ops/acks.
            messagingTemplate.convertAndSend("/topic/operations", broadcastPayload);
            logger.fine("Broadcasted transformed op from client [" + clientId + "] to /topic/operations");

            // 2. Send ACK back to the original sender ONLY
            // Use user-specific destination if possible, requires proper user handling/subscription
            // String userDestination = "/user/" + clientId + "/queue/ack"; // Example if using user destinations
            String ackDestination = "/topic/ack/" + clientId; // Simpler topic per client ID

            messagingTemplate.convertAndSend(ackDestination, "ack");
            logger.fine("Sent ACK to client [" + clientId + "] at " + ackDestination);

        } catch (IllegalArgumentException e) {
            logger.warning("Error processing operation from client [" + clientId + "]: " + e.getMessage());
            // Optionally send an error message back to the client
            // String errorDestination = "/topic/error/" + clientId;
            // messagingTemplate.convertAndSend(errorDestination, "Error: " + e.getMessage());
        } catch (Exception e) {
            logger.severe("Unexpected error processing operation from client [" + clientId + "]: " + e.getMessage());
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
        if (clientId == null) {
             logger.warning("Received selection without clientId in payload.");
             return;
        }

        logger.finest("Received selection from client [" + clientId + "]: " + payload.getSelection());

        // Broadcast selection to other clients
        Map<String, Object> broadcastPayload = new HashMap<>();
        broadcastPayload.put("clientId", clientId);
        broadcastPayload.put("selection", payload.getSelection()); // Forward the selection payload

        // Send to the main topic, clients will ignore their own ID
        messagingTemplate.convertAndSend("/topic/selections", broadcastPayload);
         logger.finest("Broadcasted selection from client [" + clientId + "] to /topic/selections");
    }

    /**
     * Handle document state requests.
     * Returns the current document content and revision number.
     */
    @MessageMapping("/get-document-state")
    public void getDocumentState() {
        // Use a Map or a dedicated DTO for the response
        Map<String, Object> stateResponse = new HashMap<>();
        stateResponse.put("document", otService.getDocumentContent());
        stateResponse.put("revision", otService.getRevision());

        logger.info("Sending document state: Revision=" + stateResponse.get("revision"));
        // Send state back to the requesting client (or broadcast if needed)
        // Assuming a broadcast for simplicity, or use user-specific destination
        messagingTemplate.convertAndSend("/topic/document-state", stateResponse);
    }
}