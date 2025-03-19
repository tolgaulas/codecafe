package com.codecafe.backend.dto;

public class DocumentState {
    private String content;
    private int version;

    public DocumentState() {
    }

    public DocumentState(String content, int version) {
        this.content = content;
        this.version = version;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public int getVersion() {
        return version;
    }

    public void setVersion(int version) {
        this.version = version;
    }
}