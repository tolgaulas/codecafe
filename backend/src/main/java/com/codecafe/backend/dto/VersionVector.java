package com.codecafe.backend.dto;

import java.util.HashMap;
import java.util.Map;

// Version vector implementation for the backend
public class VersionVector {
    private Map<String, Integer> versions = new HashMap<>();

    public VersionVector() {
        this.versions = new HashMap<>();
    }

    public VersionVector(Map<String, Integer> versions) {
        this.versions = versions != null ? versions : new HashMap<>();
    }

    public Map<String, Integer> getVersions() {
        return versions;
    }

    public void setVersions(Map<String, Integer> versions) {
        this.versions = versions;
    }

    public int getVersion(String userId) {
        return versions.getOrDefault(userId, 0);
    }

    public void update(String userId, int version) {
        versions.put(userId, Math.max(versions.getOrDefault(userId, 0), version));
    }

    public void merge(VersionVector other) {
        for (Map.Entry<String, Integer> entry : other.versions.entrySet()) {
            update(entry.getKey(), entry.getValue());
        }
    }

    public boolean happenedBefore(VersionVector other) {
        boolean atLeastOneStrictlyLess = false;

        for (Map.Entry<String, Integer> entry : versions.entrySet()) {
            String userId = entry.getKey();
            int thisVersion = entry.getValue();
            int otherVersion = other.getVersion(userId);

            if (thisVersion > otherVersion) {
                return false; // This has operations other doesn't know about
            }

            if (thisVersion < otherVersion) {
                atLeastOneStrictlyLess = true;
            }
        }

        // Check if other has users we don't know about
        for (String userId : other.versions.keySet()) {
            if (!versions.containsKey(userId) && other.getVersion(userId) > 0) {
                atLeastOneStrictlyLess = true;
            }
        }

        return atLeastOneStrictlyLess;
    }

    public boolean concurrent(VersionVector other) {
        return !this.happenedBefore(other) && !other.happenedBefore(this);
    }

    @Override
    public String toString() {
        return versions != null ? versions.toString() : "{}";
    }
}
