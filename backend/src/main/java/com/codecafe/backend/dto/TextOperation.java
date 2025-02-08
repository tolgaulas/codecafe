package com.codecafe.backend.dto;

public class TextOperation {
    private int baseVersion;
    private String newText;
    private String userId;
  
    public TextOperation() {}
    public TextOperation(int baseVersion, String newText, String userId) {
      this.baseVersion = baseVersion;
      this.newText = newText;
      this.userId = userId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
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