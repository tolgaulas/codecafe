package com.codecafe.backend.dto;

public class SelectionRange {
    private int startLineNumber;
    private int startColumn;
    private int endLineNumber;
    private int endColumn;

    // Constructors
    public SelectionRange() {}

    public SelectionRange(int startLineNumber, int startColumn, int endLineNumber, int endColumn) {
        this.startLineNumber = startLineNumber;
        this.startColumn = startColumn;
        this.endLineNumber = endLineNumber;
        this.endColumn = endColumn;
    }

    // Getters and Setters
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

    @Override
    public String toString() {
        return "SelectionRange{" +
                "startLineNumber=" + startLineNumber +
                ", startColumn=" + startColumn +
                ", endLineNumber=" + endLineNumber +
                ", endColumn=" + endColumn +
                '}';
    }
} 