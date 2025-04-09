package com.codecafe.backend.service;

import com.codecafe.backend.dto.TextOperation;
import com.codecafe.backend.dto.OperationType;
import com.codecafe.backend.dto.VersionVector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class OtServiceTest {
    private OtService otService;

    @BeforeEach
    void setUp() {
        otService = new OtService();
    }

    private TextOperation createOperation(OperationType type, int position, String text, Integer length, String userId, Map<String, Integer> versionVector) {
        TextOperation op = new TextOperation();
        op.setId(UUID.randomUUID().toString());
        op.setType(type);
        op.setPosition(position);
        op.setText(text);
        op.setLength(length);
        op.setUserId(userId);
        op.setBaseVersionVector(new VersionVector(versionVector != null ? new HashMap<>(versionVector) : new HashMap<>()));
        return op;
    }

    @Test
    void testBasicInsert() {
        TextOperation op = createOperation(OperationType.INSERT, 0, "Hello", null, "user1", new HashMap<>());
        otService.processOperation(op);
        assertEquals("Hello", otService.getDocumentContent());
    }

    @Test
    void testBasicDelete() {
        // First insert some text
        TextOperation insertOp = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
        otService.processOperation(insertOp);

        // Then delete part of it
        Map<String, Integer> vector = new HashMap<>();
        vector.put("user1", 1);
        TextOperation deleteOp = createOperation(OperationType.DELETE, 5, null, 6, "user1", vector);
        otService.processOperation(deleteOp);

        assertEquals("Hello", otService.getDocumentContent());
    }

    @Test
    void testConcurrentInserts() {
        // User 1 inserts at beginning
        TextOperation op1 = createOperation(OperationType.INSERT, 0, "Hello ", null, "user1", new HashMap<>());
        TextOperation result1 = otService.processOperation(op1);

        // User 2 inserts at same position with empty version vector (concurrent)
        TextOperation op2 = createOperation(OperationType.INSERT, 0, "World ", null, "user2", new HashMap<>());
        TextOperation result2 = otService.processOperation(op2);

        // Result should be deterministic based on user IDs
        String content = otService.getDocumentContent();
        assertTrue(
            content.equals("Hello World ") || content.equals("World Hello "),
            "Content should be either 'Hello World ' or 'World Hello ' but was: " + content
        );
    }

    @Test
    void testConcurrentEditsAtDifferentPositions() {
        // User 1 inserts at beginning
        TextOperation op1 = createOperation(OperationType.INSERT, 0, "Start ", null, "user1", new HashMap<>());
        otService.processOperation(op1);

        // Create version vector after first operation
        Map<String, Integer> vector1 = new HashMap<>();
        vector1.put("user1", 1);

        // User 1 inserts at end
        TextOperation op2 = createOperation(OperationType.INSERT, 6, "End", null, "user1", vector1);
        otService.processOperation(op2);

        // User 2 inserts in middle concurrently (based on state after first op)
        TextOperation op3 = createOperation(OperationType.INSERT, 3, "Middle ", null, "user2", vector1);
        otService.processOperation(op3);

        assertEquals("Start Middle End", otService.getDocumentContent());
    }

    @Test
    void testConcurrentDeleteAndInsert() {
        // Setup initial text
        TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
        otService.processOperation(setup);

        Map<String, Integer> vector1 = new HashMap<>();
        vector1.put("user1", 1);

        // User 1 deletes "World"
        TextOperation delete = createOperation(OperationType.DELETE, 5, null, 6, "user1", vector1);
        otService.processOperation(delete);

        // User 2 concurrently inserts at position 5 (where "World" starts)
        TextOperation insert = createOperation(OperationType.INSERT, 5, "Beautiful ", null, "user2", vector1);
        otService.processOperation(insert);

        String content = otService.getDocumentContent();
        assertTrue(content.equals("Hello Beautiful ") || content.equals("Hello"),
                "Content should handle concurrent delete and insert properly, but was: " + content);
    }

    @Test
    void testOutOfBoundsOperations() {
        // Try to insert beyond document length
        TextOperation op1 = createOperation(OperationType.INSERT, 100, "Text", null, "user1", new HashMap<>());
        otService.processOperation(op1);
        assertEquals("Text", otService.getDocumentContent());

        // Try to delete beyond document length
        TextOperation op2 = createOperation(OperationType.DELETE, 2, null, 100, "user1", new HashMap<>());
        otService.processOperation(op2);
        assertEquals("Te", otService.getDocumentContent());
    }

    @Test
    void testReplaceOperation() {
        // Insert initial text
        TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
        otService.processOperation(setup);

        Map<String, Integer> vector = new HashMap<>();
        vector.put("user1", 1);

        // Replace "World" with "Everyone"
        TextOperation replace = createOperation(OperationType.REPLACE, 6, "Everyone", 5, "user1", vector);
        otService.processOperation(replace);

        assertEquals("Hello Everyone", otService.getDocumentContent());
    }

    @Test
    void testConcurrentReplaces() {
        // Setup initial text
        TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
        otService.processOperation(setup);

        Map<String, Integer> vector1 = new HashMap<>();
        vector1.put("user1", 1);

        // User 1 replaces "World"
        TextOperation replace1 = createOperation(OperationType.REPLACE, 6, "Everyone", 5, "user1", vector1);
        otService.processOperation(replace1);

        // User 2 concurrently tries to replace "World" too
        TextOperation replace2 = createOperation(OperationType.REPLACE, 6, "Friends", 5, "user2", vector1);
        otService.processOperation(replace2);

        String content = otService.getDocumentContent();
        assertTrue(
            content.equals("Hello Everyone") || content.equals("Hello Friends"),
            "Content should be either 'Hello Everyone' or 'Hello Friends' but was: " + content
        );
    }

    @Test
    void testComplexConcurrentOperations() {
        // Initial setup
        TextOperation setup = createOperation(OperationType.INSERT, 0, "The quick brown fox", null, "user1", new HashMap<>());
        otService.processOperation(setup);

        Map<String, Integer> vector1 = new HashMap<>();
        vector1.put("user1", 1);

        // User 1 replaces "quick" with "slow"
        TextOperation op1 = createOperation(OperationType.REPLACE, 4, "slow", 5, "user1", vector1);
        otService.processOperation(op1);

        // User 2 concurrently inserts after "brown"
        TextOperation op2 = createOperation(OperationType.INSERT, 15, " and lazy", null, "user2", vector1);
        otService.processOperation(op2);

        // User 3 concurrently deletes "fox"
        TextOperation op3 = createOperation(OperationType.DELETE, 16, null, 3, "user3", vector1);
        otService.processOperation(op3);

        String content = otService.getDocumentContent();
        assertTrue(content.contains("slow") && content.contains("brown"),
                "Document should contain transformed concurrent operations, but was: " + content);
    }

    @Test
    void testVersionVectorHandling() {
        TextOperation op1 = createOperation(OperationType.INSERT, 0, "Hello", null, "user1", new HashMap<>());
        TextOperation result1 = otService.processOperation(op1);

        // Check version vector was updated
        VersionVector vv1 = result1.getBaseVersionVector();
        assertNotNull(vv1);
        assertEquals(1, vv1.getVersions().get("user1"));

        // Process another operation from same user
        Map<String, Integer> vector2 = new HashMap<>(vv1.getVersions());
        TextOperation op2 = createOperation(OperationType.INSERT, 5, " World", null, "user1", vector2);
        TextOperation result2 = otService.processOperation(op2);

        // Check version vector was incremented
        VersionVector vv2 = result2.getBaseVersionVector();
        assertNotNull(vv2);
        assertEquals(2, vv2.getVersions().get("user1"));
    }

    @Test
    void testNewlineHandling() {
        // Test with Windows-style newlines
        TextOperation op1 = createOperation(OperationType.INSERT, 0, "Line1\r\nLine2", null, "user1", new HashMap<>());
        otService.processOperation(op1);

        // Verify newlines are normalized
        String content = otService.getDocumentContent();
        assertFalse(content.contains("\r\n"), "Windows-style newlines should be normalized");
        assertTrue(content.contains("\n"), "Newlines should be preserved in Unix style");
    }
} 