package com.codecafe.backend.dto;

// Matches the structure { anchor: number, head: number }
public class OtSelectionRangeDto {
    private int anchor;
    private int head;

    // Default constructor for Jackson
    public OtSelectionRangeDto() {}

    // Getters and Setters
    public int getAnchor() { return anchor; }
    public void setAnchor(int anchor) { this.anchor = anchor; }
    public int getHead() { return head; }
    public void setHead(int head) { this.head = head; }

    @Override
    public String toString() {
        return "OtSelectionRangeDto{" + "anchor=" + anchor + ", head=" + head + '}';
    }
} 