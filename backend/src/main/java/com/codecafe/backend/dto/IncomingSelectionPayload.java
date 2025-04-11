package com.codecafe.backend.dto;

import java.util.Map;
import java.util.Objects;

/**
 * DTO representing the payload sent from the client for a selection change.
 * Contains the client's persistent ID and the selection data (as a Map for flexibility).
 */
public class IncomingSelectionPayload {

    private String clientId;
    private Map<String, Object> selection; // Can be null

    // Default constructor for Jackson
    public IncomingSelectionPayload() {
    }

    public IncomingSelectionPayload(String clientId, Map<String, Object> selection) {
        this.clientId = clientId;
        this.selection = selection;
    }

    // Getters and Setters

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public Map<String, Object> getSelection() {
        return selection;
    }

    public void setSelection(Map<String, Object> selection) {
        this.selection = selection;
    }

    // equals, hashCode, toString

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        IncomingSelectionPayload that = (IncomingSelectionPayload) o;
        return Objects.equals(clientId, that.clientId) && Objects.equals(selection, that.selection);
    }

    @Override
    public int hashCode() {
        return Objects.hash(clientId, selection);
    }

    @Override
    public String toString() {
        return "IncomingSelectionPayload{" +
                "clientId='" + clientId + '\'' +
                ", selection=" + selection +
                '}';
    }
} 