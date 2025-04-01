package com.codecafe.backend.dto;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

public class VersionVector {
    private Map<String, Integer> versions;

    /**
     * Default constructor
     */
    public VersionVector() {
        this.versions = new HashMap<>();
    }

    /**
     * Constructor with initial versions map
     */
    public VersionVector(Map<String, Integer> versions) {
        this.versions = versions != null ? new HashMap<>(versions) : new HashMap<>();
    }

    /**
     * Get the versions map
     */
    public Map<String, Integer> getVersions() {
        return versions;
    }

    /**
     * Set the versions map
     */
    public void setVersions(Map<String, Integer> versions) {
        this.versions = versions != null ? new HashMap<>(versions) : new HashMap<>();
    }

    /**
     * Update a user's version
     */
    public void update(String userId, int version) {
        Integer current = versions.getOrDefault(userId, 0);
        versions.put(userId, Math.max(current, version));
    }

    /**
     * Check if this vector is concurrent with another vector
     */
    public boolean concurrent(VersionVector other) {
        if (other == null || other.getVersions() == null) {
            return true;
        }

        boolean thisGreater = false;
        boolean otherGreater = false;

        // Check if this vector has any versions greater than other
        for (Map.Entry<String, Integer> entry : versions.entrySet()) {
            String userId = entry.getKey();
            int thisVersion = entry.getValue();
            int otherVersion = other.getVersions().getOrDefault(userId, 0);

            if (thisVersion > otherVersion) {
                thisGreater = true;
            } else if (thisVersion < otherVersion) {
                otherGreater = true;
            }
        }

        // Check if other vector has any users this one doesn't have
        for (String userId : other.getVersions().keySet()) {
            if (!versions.containsKey(userId) && other.getVersions().get(userId) > 0) {
                otherGreater = true;
            }
        }

        // They're concurrent if both have greater versions
        return thisGreater && otherGreater;
    }

    /**
     * Merge this vector with another vector, taking the maximum version for each user
     */
    public VersionVector merge(VersionVector other) {
        if (other == null || other.getVersions() == null) {
            return this;
        }

        VersionVector result = new VersionVector(this.versions);

        for (Map.Entry<String, Integer> entry : other.getVersions().entrySet()) {
            String userId = entry.getKey();
            int otherVersion = entry.getValue();
            int thisVersion = this.versions.getOrDefault(userId, 0);

            result.versions.put(userId, Math.max(thisVersion, otherVersion));
        }

        return result;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        VersionVector that = (VersionVector) o;
        return Objects.equals(versions, that.versions);
    }

    @Override
    public int hashCode() {
        return Objects.hash(versions);
    }

    @Override
    public String toString() {
        return "VersionVector{" +
                "versions=" + versions +
                '}';
    }
}