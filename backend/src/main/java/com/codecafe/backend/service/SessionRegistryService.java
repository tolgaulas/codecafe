package com.codecafe.backend.service;

import com.codecafe.backend.dto.UserInfoDTO;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;
import java.util.stream.Collectors;

@Service
public class SessionRegistryService {

    private static final Logger logger = Logger.getLogger(SessionRegistryService.class.getName());

    // Structure: Map<documentId, Map<userId, UserInfoDTO>>
    // Stores active users and their details for each document
    private final Map<String, Map<String, UserInfoDTO>> activeSessions = new ConcurrentHashMap<>();

    /**
     * Adds or updates a user's information for a specific document session.
     * TODO: This method should be called when a user successfully connects and indicates
     *       interest in a document (e.g., after receiving their first selection message
     *       or via a dedicated 'join' message).
     *
     * @param documentId The ID of the document the user joined.
     * @param userInfo The user's information.
     */
    public void userJoined(String documentId, UserInfoDTO userInfo) {
        if (userInfo == null || userInfo.getId() == null) {
             logger.warning("Attempted to add a user with null info or null ID.");
             return;
        }
        activeSessions.computeIfAbsent(documentId, k -> new ConcurrentHashMap<>()).put(userInfo.getId(), userInfo);
        logger.info(String.format("User [%s] (%s) joined document [%s]", userInfo.getId(), userInfo.getName(), documentId));
        logSessionState(); // Log current state for debugging
    }

    /**
     * Removes a user from all document sessions they might be in.
     * TODO: This method MUST be called when a user disconnects from the WebSocket.
     *       You'll need a listener for WebSocket disconnect events (e.g., SessionDisconnectEvent)
     *       and determine the userId associated with the disconnected session.
     *
     * @param userId The ID of the user who disconnected.
     */
    public void userLeft(String userId) {
         if (userId == null) {
             logger.warning("Attempted to remove a user with null ID.");
             return;
         }
        final boolean[] removed = {false};
        activeSessions.forEach((documentId, users) -> {
            if (users.remove(userId) != null) {
                logger.info(String.format("User [%s] left document [%s]", userId, documentId));
                removed[0] = true;
                // Optional: Remove the document entry if no users are left
                if (users.isEmpty()) {
                    activeSessions.remove(documentId);
                    logger.info("Document session removed as it's empty: " + documentId);
                }
            }
        });
        if (removed[0]) {
            logSessionState(); // Log current state for debugging
        } else {
             logger.fine("Attempted to remove user [" + userId + "] but they were not found in any active session.");
        }
    }

    /**
     * Updates the cursor/selection state for an active user in a specific document.
     * TODO: This could be called when receiving selection messages to keep the stored state fresh,
     *       although the primary source for the getActiveParticipantsForDocument method might
     *       just need the ID, name, and color.
     *
     * @param documentId The document ID.
     * @param userId The user ID.
     * @param cursorPosition The new cursor position (can be null).
     * @param selection The new selection (can be null).
     */
    public void updateUserState(String documentId, String userId, Map<String, Integer> cursorPosition, Object selection) {
         if (documentId == null || userId == null) {
             logger.warning("Cannot update state with null documentId or userId.");
             return;
         }
        Map<String, UserInfoDTO> usersInDocument = activeSessions.get(documentId);
        if (usersInDocument != null) {
            UserInfoDTO user = usersInDocument.get(userId);
            if (user != null) {
                user.setCursorPosition(cursorPosition);
                user.setSelection(selection);
                // No need to put back in map as we modified the object reference
                 logger.finest(String.format("Updated state for user [%s] in doc [%s]", userId, documentId));
            } else {
                 logger.warning(String.format("Cannot update state for user [%s], not found in doc [%s]", userId, documentId));
            }
        } else {
             logger.warning(String.format("Cannot update state for user [%s], doc [%s] not found in active sessions", userId, documentId));
        }
    }


    /**
     * Gets the list of active participants (UserInfoDTO) for a specific document,
     * excluding the user making the request.
     *
     * @param documentId The ID of the document.
     * @param requestingUserId The ID of the user requesting the list (to exclude them). Can be null.
     * @return A List of UserInfoDTO for other active participants, or an empty list.
     */
    public List<UserInfoDTO> getActiveParticipantsForDocument(String documentId, String requestingUserId) {
         if (documentId == null) {
             logger.warning("Cannot get participants for null documentId.");
             return Collections.emptyList();
         }
        Map<String, UserInfoDTO> usersInDocument = activeSessions.get(documentId);
        if (usersInDocument == null || usersInDocument.isEmpty()) {
            logger.fine("No active users found for document [" + documentId + "]");
            return Collections.emptyList();
        }

        // Filter out the requesting user (if provided) and collect remaining users
        List<UserInfoDTO> participants = usersInDocument.entrySet().stream()
                .filter(entry -> requestingUserId == null || !entry.getKey().equals(requestingUserId)) // Exclude requester only if ID is provided
                .map(Map.Entry::getValue)
                .collect(Collectors.toList());

        logger.info(String.format("Found %d participants for document [%s] (excluding user [%s])", participants.size(), documentId, requestingUserId));
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