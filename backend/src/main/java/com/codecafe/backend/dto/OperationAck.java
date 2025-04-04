package com.codecafe.backend.dto;

public class OperationAck {
    private String operationId;
    private VersionVector baseVersionVector;
    private String userId;

    public OperationAck() {
    }

    public OperationAck(String operationId, VersionVector versionVector, String userId) {
        this.operationId = operationId;
        this.baseVersionVector = versionVector;
        this.userId = userId;
    }

    public String getOperationId() {
        return operationId;
    }

    public void setOperationId(String operationId) {
        this.operationId = operationId;
    }

    public VersionVector getVersionVector() {
        return baseVersionVector;
    }

    public void setVersionVector(VersionVector versionVector) {
        this.baseVersionVector = versionVector;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}