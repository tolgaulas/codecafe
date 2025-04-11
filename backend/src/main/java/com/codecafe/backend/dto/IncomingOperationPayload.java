package com.codecafe.backend.dto;

import java.util.Objects;

/**
 * DTO representing the payload sent from the client for an operation.
 * Contains the client's known revision and the operation itself.
 */
public class IncomingOperationPayload {

    private String clientId;
    private int revision;
    private TextOperation operation; // Assumes TextOperation is already Jackson-compatible (or custom serializer exists)

    // Default constructor for deserialization
    public IncomingOperationPayload() {
    }

    public IncomingOperationPayload(String clientId, int revision, TextOperation operation) {
        this.clientId = clientId;
        this.revision = revision;
        this.operation = operation;
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

    public TextOperation getOperation() {
        return operation;
    }

    public void setOperation(TextOperation operation) {
        this.operation = operation;
    }

    // equals, hashCode, toString (optional but good practice)

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        IncomingOperationPayload that = (IncomingOperationPayload) o;
        return revision == that.revision &&
                Objects.equals(clientId, that.clientId) &&
                Objects.equals(operation, that.operation);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clientId, revision, operation);
    }

    @Override
    public String toString() {
        return "IncomingOperationPayload{" +
                "clientId='" + clientId + '\'' +
                ", revision=" + revision +
                ", operation=" + operation +
                '}';
    }
} 