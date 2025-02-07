package com.codecafe.backend.dto;

public class OtOperation {
    private int baseVersion;   // The version of the doc this op is based on
    private int position;      // Position in text to apply
    private String insertedText;
    private int deleteCount;

    public OtOperation(int baseVersion, int position, String insertedText, int deleteCount) {
        this.baseVersion = baseVersion;
        this.position = position;
        this.insertedText = insertedText;
        this.deleteCount = deleteCount;
    }

    public int getBaseVersion() {
        return baseVersion;
    }

    public void setBaseVersion(int baseVersion) {
        this.baseVersion = baseVersion;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public String getInsertedText() {
        return insertedText;
    }

    public void setInsertedText(String insertedText) {
        this.insertedText = insertedText;
    }

    public int getDeleteCount() {
        return deleteCount;
    }

    public void setDeleteCount(int deleteCount) {
        this.deleteCount = deleteCount;
    }

    @Override
    public String toString() {
        return "OtOperation{" +
                "baseVersion=" + baseVersion +
                ", position=" + position +
                ", insertedText='" + insertedText + '\'' +
                ", deleteCount=" + deleteCount +
                '}';
    }
    
}