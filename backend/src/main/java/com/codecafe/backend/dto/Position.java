package com.codecafe.backend.dto;

public class Position {
    private int lineNumber;
    private int column;
    // Getters and setters
    public int getLineNumber() {
        return lineNumber;
    }
    public void setLineNumber(int lineNumber) {
        this.lineNumber = lineNumber;
    }
    public int getColumn() {
        return column;
    }
    public void setColumn(int column) {
        this.column = column;
    }
}