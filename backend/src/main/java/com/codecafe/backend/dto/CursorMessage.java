package com.codecafe.backend.dto;

public class CursorMessage {
    // Renamed 'user' to 'userInfo' to avoid ambiguity with potential principal/user objects
    private UserInfo userInfo;
    // Keep documentId if cursors are document-specific, remove if session-wide
    private String documentId;
    private String sessionId;


    // Getters and Setters
    public UserInfo getUserInfo() {
        return userInfo;
    }

    public void setUserInfo(UserInfo userInfo) {
        this.userInfo = userInfo;
    }

     public String getDocumentId() {
        return documentId;
    }

    public void setDocumentId(String documentId) {
        this.documentId = documentId;
    }

     public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }


    @Override
    public String toString() {
        return "CursorMessage{" +
                "userInfo=" + userInfo +
                ", documentId='" + documentId + "\'" +
                ", sessionId='" + sessionId + "\'" +
                '}';
    }
}

