package com.codecafe.backend.dto;

public class TextOperation {
    private String id;
    private OperationType type;
    private int position;
    private String text;
    private Integer length;
    private VersionVector baseVersionVector; // Changed from version to baseVersionVector
    private String userId;

    // Getters and setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public OperationType getType() {
        return type;
    }

    public void setType(OperationType type) {
        this.type = type;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public Integer getLength() {
        return length;
    }

    public void setLength(Integer length) {
        this.length = length;
    }

    public VersionVector getBaseVersionVector() {
        return baseVersionVector;
    }

    public void setBaseVersionVector(VersionVector baseVersionVector) {
        this.baseVersionVector = baseVersionVector != null ? baseVersionVector : new VersionVector();
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    @Override
    public String toString() {
        return "TextOperation{" +
                "id='" + id + '\'' +
                ", type=" + type +
                ", position=" + position +
                ", text='" + text + '\'' +
                ", length=" + length +
                ", baseVersionVector=" + baseVersionVector +
                ", userId='" + userId + '\'' +
                '}';
    }
}