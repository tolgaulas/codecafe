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

    public OtController(OtService otService) {
        this.otService = otService;
    }

    private String code = "// Hello there";
  private int version = 0;

  @MessageMapping("/otOperation")
  @SendTo("/topic/ot")
  public TextOperation handleOtOperation(@Payload TextOperation op) {
    // If op.baseVersion < version, in a real scenario, you'd do transform
    // For now, we overwrite with new text and assume the client has done the version check
    code = op.getNewText();
    version++;
    TextOperation newOp = new TextOperation(version, code);
    return newOp;
  }
}