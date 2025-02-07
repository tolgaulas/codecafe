package com.codecafe.backend.dto;

public class TextOperation {
    private int baseVersion;
    private String newText;
  
    public TextOperation() {}
    public TextOperation(int baseVersion, String newText) {
      this.baseVersion = baseVersion;
      this.newText = newText;
    }
    
    public int getBaseVersion() {
        return baseVersion;
    }

    public void setBaseVersion(int baseVersion) {
        this.baseVersion = baseVersion;
    }

    public String getNewText() {
        return newText;
    }

    public void setNewText(String newText) {
        this.newText = newText;
    }
  }