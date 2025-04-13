package com.codecafe.backend.dto;

import java.util.Map;

// Data Transfer Object for user information sent to the frontend
public class UserInfoDTO {

    private String id;
    private String name;
    private String color;
    // Representing cursor position, e.g., {"lineNumber": 10, "column": 5}
    private Map<String, Integer> cursorPosition;
    // Representing OT selection JSON structure, e.g., {"ranges": [{"anchor": 1, "head": 10}]}
    // Using Object allows flexibility for Jackson serialization
    private Object selection;

    // Constructors (optional, but good practice)
    public UserInfoDTO() {
    }

    public UserInfoDTO(String id, String name, String color, Map<String, Integer> cursorPosition, Object selection) {
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

    public Map<String, Integer> getCursorPosition() {
        return cursorPosition;
    }

    public void setCursorPosition(Map<String, Integer> cursorPosition) {
        this.cursorPosition = cursorPosition;
    }

    public Object getSelection() {
        return selection;
    }

    public void setSelection(Object selection) {
        this.selection = selection;
    }
} 