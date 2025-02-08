package com.codecafe.backend.dto;

public class Selection {
    private int startLineNumber;
    private int startColumn;
    private int endLineNumber;
    private int endColumn;

    // Getters and setters
    public int getStartLineNumber() {
        return startLineNumber;
    }
    public void setStartLineNumber(int startLineNumber) {
        this.startLineNumber = startLineNumber;
    }
    public int getStartColumn() {
        return startColumn;
    }
    public void setStartColumn(int startColumn) {
        this.startColumn = startColumn;
    }
    public int getEndLineNumber() {
        return endLineNumber;
    }
    public void setEndLineNumber(int endLineNumber) {
        this.endLineNumber = endLineNumber;
    }
    public int getEndColumn() {
        return endColumn;
    }
    public void setEndColumn(int endColumn) {
        this.endColumn = endColumn;
    }
}
  