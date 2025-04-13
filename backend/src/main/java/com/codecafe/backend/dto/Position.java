package com.codecafe.backend.dto;

public class Position {
    private int lineNumber;
    private int column;

    // Constructors
    public Position() {}

    public Position(int lineNumber, int column) {
        this.lineNumber = lineNumber;
        this.column = column;
    }

    // Getters and Setters
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

    @Override
    public String toString() {
        return "Position{" +
                "lineNumber=" + lineNumber +
                ", column=" + column +
                '}';
    }
}