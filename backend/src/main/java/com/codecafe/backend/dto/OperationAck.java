package com.codecafe.backend.dto;

public class OperationAck {
    private String operationId;
    private int version;
    private String userId;

    public OperationAck() {
    }

    public OperationAck(String operationId, int version, String userId) {
        this.operationId = operationId;
        this.version = version;
        this.userId = userId;
    }

    public String getOperationId() {
        return operationId;
    }

    public void setOperationId(String operationId) {
        this.operationId = operationId;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
