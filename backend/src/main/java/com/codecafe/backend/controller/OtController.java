package com.codecafe.backend.controller;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.service.OtService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class OtController {
    private final OtService otService;
    private String code = "// Hello there";
    private int version = 0;

    public OtController(OtService otService) {
        this.otService = otService;
    }

    @MessageMapping("/otOperation")
    @SendTo("/topic/ot")
    public TextOperation handleOtOperation(@Payload TextOperation op) {
        code = op.getNewText();
        version++;
        return new TextOperation(version, code, op.getUserId());
    }
}