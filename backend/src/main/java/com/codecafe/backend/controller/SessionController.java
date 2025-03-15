package com.codecafe.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    // In-memory storage for sessions (replace with database in production)
    private static final Map<String, SessionInfo> activeSessions = new ConcurrentHashMap<>();

    static class SessionInfo {
        private final String id;
        private final String creatorName;
        private final long createdAt;

        public SessionInfo(String id, String creatorName) {
            this.id = id;
            this.creatorName = creatorName;
            this.createdAt = System.currentTimeMillis();
        }

        public String getId() {
            return id;
        }

        public String getCreatorName() {
            return creatorName;
        }

        public long getCreatedAt() {
            return createdAt;
        }
    }

    @PostMapping("/create")
    public ResponseEntity<Map<String, String>> createSession(@RequestBody Map<String, String> request) {
        String creatorName = request.getOrDefault("creatorName", "Anonymous");
        
        // Generate a unique session ID
        String sessionId = UUID.randomUUID().toString();
        
        // Store session info
        activeSessions.put(sessionId, new SessionInfo(sessionId, creatorName));
        
        Map<String, String> response = new HashMap<>();
        response.put("sessionId", sessionId);
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<SessionInfo> getSessionInfo(@PathVariable String sessionId) {
        SessionInfo sessionInfo = activeSessions.get(sessionId);
        
        if (sessionInfo == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(sessionInfo);
    }
}
