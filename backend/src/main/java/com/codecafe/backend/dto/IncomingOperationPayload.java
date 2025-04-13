package com.codecafe.backend.dto;

import java.util.List;
import java.util.Objects;

/**
 * DTO representing the payload sent from the client for an operation.
 * Contains the client's known revision and the operation itself.
 */
public class IncomingOperationPayload {

    private String clientId;
    private int revision;
    private List<Object> operation; // Raw operation list (numbers or strings)
    private String documentId;
    private String sessionId;

    // Default constructor for deserialization
    public IncomingOperationPayload() {
    }

    public IncomingOperationPayload(String clientId, int revision, List<Object> operation, String documentId, String sessionId) {
        this.clientId = clientId;
        this.revision = revision;
        this.operation = operation;
        this.documentId = documentId;
        this.sessionId = sessionId;
    }

    // Getters and Setters

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public int getRevision() {
        return revision;
    }

    public void setRevision(int revision) {
        this.revision = revision;
    }

    public List<Object> getOperation() {
        return operation;
    }

    public void setOperation(List<Object> operation) {
        this.operation = operation;
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

    // equals, hashCode, toString (optional but good practice)

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        IncomingOperationPayload that = (IncomingOperationPayload) o;
        return revision == that.revision &&
                Objects.equals(clientId, that.clientId) &&
                Objects.equals(operation, that.operation) &&
                Objects.equals(documentId, that.documentId) &&
                Objects.equals(sessionId, that.sessionId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clientId, revision, operation, documentId, sessionId);
    }

    @Override
    public String toString() {
        return "IncomingOperationPayload{" +
                "clientId='" + clientId + '\'' +
                ", revision=" + revision +
                ", operation=" + operation +
                ", documentId='" + documentId + '\'' +
                ", sessionId='" + sessionId + '\'' +
                '}';
    }
} 