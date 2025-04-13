package com.codecafe.backend.dto;

// Assuming UserInfoDTO exists or will be created
import java.util.List;
import com.codecafe.backend.dto.UserInfoDTO; // Import the newly created DTO

public class DocumentState {
    private String documentId;
    private String document;
    private int revision;
    private String sessionId;
    // private VersionVector versionVector; // Commented out/Removed if using simple revision
    private List<UserInfoDTO> participants;

    public DocumentState() {
    }

    // Optional: Update constructor if needed
    // public DocumentState(String documentId, String document, int revision, String sessionId, List<UserInfoDTO> participants) {
    //     this.documentId = documentId;
    //     this.document = document;
    //     this.revision = revision;
    //     this.sessionId = sessionId;
    //     this.participants = participants;
    // }

    public String getDocumentId() {
        return documentId;
    }

    public void setDocumentId(String documentId) {
        this.documentId = documentId;
    }

    public String getDocument() {
        return document;
    }

    public void setDocument(String document) {
        this.document = document;
    }

    public int getRevision() {
        return revision;
    }

    public void setRevision(int revision) {
        this.revision = revision;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public List<UserInfoDTO> getParticipants() {
        return participants;
    }

    public void setParticipants(List<UserInfoDTO> participants) {
        this.participants = participants;
    }

    // public VersionVector getVersionVector() {
    //     return versionVector;
    // }

    // public void setVersionVector(VersionVector versionVector) {
    //     this.versionVector = versionVector;
    // }
}