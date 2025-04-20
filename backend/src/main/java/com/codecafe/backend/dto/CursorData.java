package com.codecafe.backend.dto;

public class CursorData {
    private Position cursorPosition;
    private Selection selection;
    
    // Getters and setters
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