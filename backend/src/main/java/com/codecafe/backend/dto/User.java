package com.codecafe.backend.dto;

public class User {
    private String id;
    private String name;
    private String color;
    private CursorPosition cursorPosition;
    private Selection selection;

    // Getters and setters

    public static class CursorPosition {
        private int lineNumber;
        private int column;

        // Getters and setters
    }

    public static class Selection {
        private int startLineNumber;
        private int startColumn;
        private int endLineNumber;
        private int endColumn;

        // Getters and setters
    }
}
