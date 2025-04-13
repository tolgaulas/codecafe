package com.codecafe.backend.service;

import com.codecafe.backend.dto.UserInfoDTO;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;
import java.util.stream.Collectors;
import java.util.AbstractMap;
import java.util.ArrayList;

@Service
public class SessionRegistryService {

    private static final Logger logger = Logger.getLogger(SessionRegistryService.class.getName());

    // Structure: Map<sessionId, Map<documentId, Map<userId, UserInfoDTO>>>
    // Stores active users and their details for each document within each session
    private final Map<String, Map<String, Map<String, UserInfoDTO>>> activeSessions = new ConcurrentHashMap<>();

    /**
     * Gets or creates the map of documents for a given session ID.
     * Must be called within a locked context if external locking is used.
     */
    private Map<String, Map<String, UserInfoDTO>> getOrCreateSessionMap(String sessionId) {
        return activeSessions.computeIfAbsent(sessionId, k -> {
            logger.info("Creating new session map for session ID: " + sessionId);
            return new ConcurrentHashMap<>();
        });
    }

    /**
     * Gets or creates the map of users for a given document ID within a specific session.
     * Must be called within a locked context if external locking is used.
     */
    private Map<String, UserInfoDTO> getOrCreateDocumentUserMap(String sessionId, String documentId) {
        Map<String, Map<String, UserInfoDTO>> sessionMap = getOrCreateSessionMap(sessionId);
        return sessionMap.computeIfAbsent(documentId, k -> {
            logger.info(String.format("[Session: %s] Creating new document user map for document ID: %s", sessionId, documentId));
            return new ConcurrentHashMap<>();
        });
    }

    /**
     * Adds or updates a user's information for a specific document within a specific session.
     * @param sessionId The ID of the session the user joined.
     * @param documentId The ID of the document the user joined.
     * @param userInfo The user's information.
     */
    public void userJoined(String sessionId, String documentId, UserInfoDTO userInfo) {
        if (sessionId == null || documentId == null || userInfo == null || userInfo.getId() == null) {
             logger.warning("Attempted to add a user with null sessionId, documentId, info, or user ID.");
             return;
        }
        Map<String, UserInfoDTO> userMap = getOrCreateDocumentUserMap(sessionId, documentId);
        userMap.put(userInfo.getId(), userInfo);
        logger.info(String.format("[Session: %s] User [%s] (%s) joined document [%s]", sessionId, userInfo.getId(), userInfo.getName(), documentId));
        logSessionState(); // Log current state for debugging
    }

    /**
     * Removes a user from all document sessions they might be in across all sessions.
     * This iterates through all sessions, which might be inefficient for large numbers of sessions.
     * Consider modifying this if the WebSocket disconnect event can provide the session ID.
     *
     * @param userId The ID of the user who disconnected.
     * @return A list of Map.Entry where key is sessionId and value is documentId that the user left.
     */
    public List<Map.Entry<String, String>> userLeft(String userId) {
         if (userId == null) {
             logger.warning("Attempted to remove a user with null ID.");
             return Collections.emptyList();
         }
        // List to store affected session/document pairs
        List<Map.Entry<String, String>> affectedEntries = new ArrayList<>();

        activeSessions.forEach((sessionId, documentMap) -> {
            List<String> documentsToRemoveFromSession = new ArrayList<>(); // Store keys to remove from inner map
            documentMap.forEach((documentId, users) -> {
                if (users.remove(userId) != null) {
                    logger.info(String.format("[Session: %s] User [%s] left document [%s]", sessionId, userId, documentId));
                    affectedEntries.add(new AbstractMap.SimpleEntry<>(sessionId, documentId)); // Add to affected list
                    // Check if the user map for the document is now empty
                    if (users.isEmpty()) {
                        documentsToRemoveFromSession.add(documentId); // Mark document user map for removal
                        logger.info(String.format("[Session: %s] Document user map removed as it's empty: %s", sessionId, documentId));
                    }
                }
            });
            // Remove empty document user maps from the session map
            documentsToRemoveFromSession.forEach(documentMap::remove);
        });

        // Remove empty session maps from the main map (after iterating documents)
        List<String> sessionsToRemove = new ArrayList<>();
        activeSessions.forEach((sessionId, documentMap) -> {
            if (documentMap.isEmpty()) {
                 sessionsToRemove.add(sessionId);
                 logger.info(String.format("Session map removed as it's empty: %s", sessionId));
            }
        });
        sessionsToRemove.forEach(activeSessions::remove);

        if (!affectedEntries.isEmpty()) {
            logSessionState(); // Log current state for debugging if changes were made
        } else {
             logger.fine("Attempted to remove user [" + userId + "] but they were not found in any active session/document.");
        }
        return affectedEntries; // Return the list of affected entries
    }

    /**
     * Updates the cursor/selection state for an active user in a specific document within a specific session.
     *
     * @param sessionId The session ID.
     * @param documentId The document ID.
     * @param userId The user ID.
     * @param cursorPosition The new cursor position (can be null).
     * @param selection The new selection (can be null).
     */
    public void updateUserState(String sessionId, String documentId, String userId, Map<String, Integer> cursorPosition, Object selection) {
         if (sessionId == null || documentId == null || userId == null) {
             logger.warning("Cannot update state with null sessionId, documentId or userId.");
             return;
         }
        Map<String, Map<String, UserInfoDTO>> sessionMap = activeSessions.get(sessionId);
        if (sessionMap != null) {
            Map<String, UserInfoDTO> usersInDocument = sessionMap.get(documentId);
            if (usersInDocument != null) {
                UserInfoDTO user = usersInDocument.get(userId);
                if (user != null) {
                    user.setCursorPosition(cursorPosition);
                    user.setSelection(selection);
                    // No need to put back in map as we modified the object reference
                    logger.finest(String.format("[Session: %s] Updated state for user [%s] in doc [%s]", sessionId, userId, documentId));
                } else {
                    logger.warning(String.format("[Session: %s] Cannot update state for user [%s], not found in doc [%s]", sessionId, userId, documentId));
                }
            } else {
                logger.warning(String.format("[Session: %s] Cannot update state for user [%s], doc [%s] not found in session map", sessionId, userId, documentId));
            }
        } else {
            logger.warning(String.format("Cannot update state for user [%s], session [%s] not found in active sessions", userId, sessionId));
        }
    }

    /**
     * Gets the list of active participants (UserInfoDTO) for a specific document within a specific session,
     * excluding the user making the request.
     *
     * @param sessionId The ID of the session.
     * @param documentId The ID of the document.
     * @param requestingUserId The ID of the user requesting the list (to exclude them). Can be null.
     * @return A List of UserInfoDTO for other active participants, or an empty list.
     */
    public List<UserInfoDTO> getActiveParticipantsForDocument(String sessionId, String documentId, String requestingUserId) {
         if (sessionId == null || documentId == null) {
             logger.warning("Cannot get participants for null sessionId or documentId.");
             return Collections.emptyList();
         }
        Map<String, Map<String, UserInfoDTO>> sessionMap = activeSessions.get(sessionId);
        if (sessionMap == null) {
            logger.fine("No active session found for session ID [" + sessionId + "]");
            return Collections.emptyList();
        }

        Map<String, UserInfoDTO> usersInDocument = sessionMap.get(documentId);
        if (usersInDocument == null || usersInDocument.isEmpty()) {
            logger.fine(String.format("[Session: %s] No active users found for document [%s]", sessionId, documentId));
            return Collections.emptyList();
        }

        // Filter out the requesting user (if provided) and collect remaining users
        List<UserInfoDTO> participants = usersInDocument.entrySet().stream()
                .filter(entry -> requestingUserId == null || !entry.getKey().equals(requestingUserId)) // Exclude requester only if ID is provided
                .map(Map.Entry::getValue)
                .collect(Collectors.toList());

        logger.info(String.format("[Session: %s] Found %d participants for document [%s] (excluding user [%s])", sessionId, participants.size(), documentId, requestingUserId));
        return participants;
    }

    // Helper method for debugging
    private void logSessionState() {
        // Check log level to avoid performance impact of toString() on large maps
        if (logger.isLoggable(java.util.logging.Level.FINE)) {
             logger.fine("Current Session Registry State: " + activeSessions.toString());
        }
    }
}