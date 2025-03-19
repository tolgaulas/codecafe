package com.codecafe.backend.dto;
import com.codecafe.backend.dto.OperationType;

public class TextOperation {
    private String id;           // Unique operation ID
    private OperationType type;  // Operation type (INSERT, DELETE, REPLACE)
    private int position;        // Position in the document
    private String text;         // Text to insert or replacement text
    private Integer length;      // Length of text to delete or replace
    private int version;         // Document version this operation is based on
    private String userId;       // User who created this operation

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