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
import java.util.List;
import java.util.Collections;
import com.codecafe.backend.dto.UserInfoDTO;
import com.codecafe.backend.service.SessionRegistryService;

@Controller
public class OtController {
    private final OtService otService;
    private final SimpMessagingTemplate messagingTemplate;
    private final SessionRegistryService sessionRegistryService;
    private static final Logger logger = Logger.getLogger(OtController.class.getName());

    public OtController(OtService otService, SimpMessagingTemplate messagingTemplate, SessionRegistryService sessionRegistryService) {
        this.otService = otService;
        this.messagingTemplate = messagingTemplate;
        this.sessionRegistryService = sessionRegistryService;
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
     * @param payload JSON representation of the selection (e.g., { ranges: [{ anchor: number, head: number }] })
     * @param headerAccessor Accessor for STOMP headers.
     * @param principal Optional principal.
     */
    // @MessageMapping("/selection") // Removed mapping to resolve conflict with EditorController
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
     * Returns the current document content, revision number, and active participants for that document.
     */
    @MessageMapping("/get-document-state")
    public void getDocumentState(@Payload Map<String, String> payload, Principal principal) {
        String documentId = payload.get("documentId");

        // --- Determine Requesting User ID (Placeholder) ---
        String requestingUserId = null;
        if (principal != null) {
            // Assuming principal.getName() corresponds to the User ID used elsewhere (e.g., clientId)
            requestingUserId = principal.getName();
            logger.info("Identified requesting user ID: " + requestingUserId);
        } else {
            // Fallback or error if principal is needed but missing
            // This might happen depending on WebSocket security configuration
            logger.warning("Principal not available for get-document-state request. Cannot exclude requester from participant list.");
            // Decide how to handle this - maybe still fetch all participants?
        }
        // ---------------------------------------------------

        if (documentId == null) {
            logger.warning("Received get-document-state request without documentId. Ignoring.");
            return;
        }

        logger.info("Received request for document state for doc [" + documentId + "] from user [" + (requestingUserId != null ? requestingUserId : "unknown") + "]");

        // --- Fetch Participants (Placeholder) ---
        List<UserInfoDTO> participants = Collections.emptyList(); // Default to empty list
        try {
            // TODO: Replace this with your actual service call, passing requestingUserId for exclusion
            participants = sessionRegistryService.getActiveParticipantsForDocument(documentId, requestingUserId);
            logger.info("Fetched participants for document [" + documentId + "] (excluding user [" + requestingUserId + "])");

        } catch (Exception e) {
            logger.severe("Error fetching participants for document [" + documentId + "]: " + e.getMessage());
        }
        // ---------------------------------------


        // --- Use DocumentState DTO for the response ---
        DocumentState stateResponse = new DocumentState();
        stateResponse.setDocumentId(documentId);
        stateResponse.setDocument(otService.getDocumentContent(documentId));
        stateResponse.setRevision(otService.getRevision(documentId));
        // --- Set the fetched participants list --- 
        stateResponse.setParticipants(participants); // Uncommented
        // -----------------------------------------


        logger.info("Sending document state: Revision=" + stateResponse.getRevision() +
                    ", Participants Count=" + stateResponse.getParticipants().size() + // Use getter
                    " for doc [" + documentId + "]");

        // Send state back using the DTO
        messagingTemplate.convertAndSend("/topic/document-state", stateResponse);
    }
}