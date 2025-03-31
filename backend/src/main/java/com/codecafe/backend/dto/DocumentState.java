package com.codecafe.backend.dto;

public class DocumentState {
    private String content;
    private VersionVector versionVector;

    public DocumentState() {
    }

    public DocumentState(String content, VersionVector versionVector) {
        this.content = content;
        this.versionVector = versionVector;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public VersionVector getVersionVector() {
        return versionVector;
    }

    public void setVersionVector(VersionVector versionVector) {
        this.versionVector = versionVector;
    }
}