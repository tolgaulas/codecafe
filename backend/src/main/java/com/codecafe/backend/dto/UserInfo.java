package com.codecafe.backend.dto;

public class UserInfo {
    private String id;
    private String name;
    private String color;
    private Position cursorPosition; // Represents the user's cursor
    private OtSelectionDto selection; // Use OtSelectionDto to match frontend

    // Constructors
    public UserInfo() {}

    public UserInfo(String id, String name, String color, Position cursorPosition, OtSelectionDto selection) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.cursorPosition = cursorPosition;
        this.selection = selection;
    }

    // Getters and Setters
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

    public OtSelectionDto getSelection() {
        return selection;
    }

    public void setSelection(OtSelectionDto selection) {
        this.selection = selection;
    }

    @Override
    public String toString() {
        return "UserInfo{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", color='" + color + '\'' +
                ", cursorPosition=" + cursorPosition +
                ", selection=" + selection +
                '}';
    }
}


