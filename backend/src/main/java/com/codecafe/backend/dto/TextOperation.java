package com.codecafe.backend.dto;

import java.util.Objects;

public class TextOperation {
    private String id;
    private OperationType type;
    private int position;
    private String text;
    private Integer length;
    private int version;
    private String userId;

    public TextOperation() {
        // Default constructor
    }

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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        TextOperation that = (TextOperation) o;
        return position == that.position &&
                version == that.version &&
                Objects.equals(id, that.id) &&
                type == that.type &&
                Objects.equals(text, that.text) &&
                Objects.equals(length, that.length) &&
                Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, type, position, text, length, version, userId);
    }

    @Override
    public String toString() {
        return "TextOperation{" +
                "id='" + id + '\'' +
                ", type=" + type +
                ", position=" + position +
                ", text='" + text + '\'' +
                ", length=" + length +
                ", version=" + version +
                ", userId='" + userId + '\'' +
                '}';
    }

    /**
     * Creates a deep copy of this TextOperation
     */
    public TextOperation clone() {
        TextOperation clone = new TextOperation();
        clone.setId(this.id);
        clone.setType(this.type);
        clone.setPosition(this.position);
        clone.setText(this.text);
        clone.setLength(this.length);
        clone.setVersion(this.version);
        clone.setUserId(this.userId);
        return clone;
    }
}