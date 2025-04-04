package com.codecafe.backend.controller;

import com.codecafe.backend.dto.DocumentState;
import com.codecafe.backend.dto.OperationAck;
import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.service.OtService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class OtController {
    private final OtService otService;
    private final SimpMessagingTemplate messagingTemplate;

    public OtController(OtService otService, SimpMessagingTemplate messagingTemplate) {
        this.otService = otService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Handle incoming operations from clients
     */
    @MessageMapping("/operation")
    public void handleOperation(@Payload TextOperation operation) {
        // Process the operation (transform if necessary and apply)
        TextOperation processedOp = otService.processOperation(operation);

        // Broadcast the processed operation to all clients
        messagingTemplate.convertAndSend("/topic/operations", processedOp);

        // Send acknowledgment back to clients
        OperationAck ack = new OperationAck(operation.getId(), processedOp.getBaseVersionVector(), operation.getUserId());
        System.out.println("Base version vector: " + processedOp.getBaseVersionVector());
        System.out.println("Base version vector map: " + processedOp.getBaseVersionVector().getVersions());
        messagingTemplate.convertAndSend("/topic/operation-ack", ack);
    }

    /**
     * Handle document state requests
     */
    @MessageMapping("/get-document-state")
    public void getDocumentState() {
        DocumentState state = new DocumentState(
                otService.getDocumentContent(),
                otService.getServerVersionVector()
        );

        messagingTemplate.convertAndSend("/topic/document-state", state);
    }
}