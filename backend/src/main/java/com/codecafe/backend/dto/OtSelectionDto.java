package com.codecafe.backend.dto;

import java.util.List;

// Matches the structure { ranges: [ { anchor, head } ] }
public class OtSelectionDto {
    private List<OtSelectionRangeDto> ranges;

    // Default constructor for Jackson
    public OtSelectionDto() {}

    // Getters and Setters
    public List<OtSelectionRangeDto> getRanges() { return ranges; }
    public void setRanges(List<OtSelectionRangeDto> ranges) { this.ranges = ranges; }

    @Override
    public String toString() {
        return "OtSelectionDto{" + "ranges=" + ranges + '}';
    }
} 