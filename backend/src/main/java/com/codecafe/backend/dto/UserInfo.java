package com.codecafe.backend.dto;

public class UserInfo {
    private String id;
    private String name;
    private String color;
    private Position cursorPosition;  // directly on UserInfo
    private Selection selection;      // directly on UserInfo

    // Getters and setters
    public String getId() {
        return id;
    }
    public void setId(String id) {
        this.id = id;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getColor() {
        return color;
    }
    public void setColor(String color) {
        this.color = color;
    }
    public Position getCursorPosition() {
        return cursorPosition;
    }
    public void setCursorPosition(Position cursorPosition) {
        this.cursorPosition = cursorPosition;
    }
    public Selection getSelection() {
        return selection;
    }
    public void setSelection(Selection selection) {
        this.selection = selection;
    }
}


