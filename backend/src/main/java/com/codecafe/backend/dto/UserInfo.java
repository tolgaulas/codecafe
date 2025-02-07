package com.codecafe.backend.dto;

public class UserInfo {
    private String id;
    private String name;
    private String color;
    private CursorData cursor;  // Use similar structure as your frontend
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
    public CursorData getCursor() {
        return cursor;
    }
    public void setCursor(CursorData cursor) {
        this.cursor = cursor;
    }
  }