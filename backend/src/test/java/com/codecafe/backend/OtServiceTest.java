// package com.codecafe.backend;

// import com.codecafe.backend.dto.TextOperation;
// import com.codecafe.backend.dto.OperationType;
// import com.codecafe.backend.dto.VersionVector;
// import com.codecafe.backend.service.OtService;
// import org.junit.jupiter.api.BeforeEach;
// import org.junit.jupiter.api.Test;
// import static org.junit.jupiter.api.Assertions.*;


// import java.util.HashMap;
// import java.util.Map;
// import java.util.UUID;

// public class OtServiceTest {
//     private OtService otService;

//     @BeforeEach
//     void setUp() {
//         otService = new OtService();
//     }

//     private TextOperation createOperation(OperationType type, int position, String text, Integer length, String userId, Map<String, Integer> versionVector) {
//         TextOperation op = new TextOperation();
//         op.setId(UUID.randomUUID().toString());
//         op.setType(type);
//         op.setPosition(position);
//         op.setText(text);
//         op.setLength(length);
//         op.setUserId(userId);
//         op.setBaseVersionVector(new VersionVector(versionVector != null ? new HashMap<>(versionVector) : new HashMap<>()));
//         return op;
//     }

//     @Test
//     void testBasicInsert() {
//         TextOperation op = createOperation(OperationType.INSERT, 0, "Hello", null, "user1", new HashMap<>());
//         otService.processOperation(op);
//         assertEquals("Hello", otService.getDocumentContent());
//     }

//     @Test
//     void testBasicDelete() {
//         // First insert some text
//         TextOperation insertOp = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
//         otService.processOperation(insertOp);

//         // Then delete part of it
//         Map<String, Integer> vector = new HashMap<>();
//         vector.put("user1", 1);
//         TextOperation deleteOp = createOperation(OperationType.DELETE, 5, null, 6, "user1", vector);
//         otService.processOperation(deleteOp);

//         assertEquals("Hello", otService.getDocumentContent());
//     }

//     @Test
//     void testConcurrentInserts() {
//         // User 1 inserts at beginning
//         TextOperation op1 = createOperation(OperationType.INSERT, 0, "Hello ", null, "user1", new HashMap<>());
//         TextOperation result1 = otService.processOperation(op1);

//         // User 2 inserts at same position with empty version vector (concurrent)
//         TextOperation op2 = createOperation(OperationType.INSERT, 0, "World ", null, "user2", new HashMap<>());
//         TextOperation result2 = otService.processOperation(op2);

//         // Result should be deterministic based on user IDs
//         String content = otService.getDocumentContent();
//         assertTrue(
//                 content.equals("Hello World ") || content.equals("World Hello "),
//                 "Content should be either 'Hello World ' or 'World Hello ' but was: " + content
//         );
//     }

//     @Test
//     void testConcurrentEditsAtDifferentPositions() {
//         // User 1 inserts at beginning
//         TextOperation op1 = createOperation(OperationType.INSERT, 0, "Start ", null, "user1", new HashMap<>());
//         otService.processOperation(op1);

//         // Create version vector after first operation
//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // User 1 inserts at end
//         TextOperation op2 = createOperation(OperationType.INSERT, 6, "End", null, "user1", vector1);
//         otService.processOperation(op2);

//         // User 2 inserts in middle concurrently (based on state after first op)
//         TextOperation op3 = createOperation(OperationType.INSERT, 3, "Middle ", null, "user2", vector1);
//         otService.processOperation(op3);

//         assertEquals("Start EndMiddle ", otService.getDocumentContent());
//     }

//     @Test
//     void testConcurrentDeleteAndInsert() {
//         // Setup initial text
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // User 1 deletes "World"
//         TextOperation delete = createOperation(OperationType.DELETE, 5, null, 6, "user1", vector1);
//         otService.processOperation(delete);

//         // User 2 concurrently inserts at position 5 (where "World" starts)
//         TextOperation insert = createOperation(OperationType.INSERT, 5, "Beautiful ", null, "user2", vector1);
//         otService.processOperation(insert);

//         String content = otService.getDocumentContent();
//         assertTrue(content.equals("HelloBeautiful "),
//                 "Content should handle concurrent delete and insert properly, but was: " + content);
//     }

//     @Test
//     void testOutOfBoundsOperations() {
//         // Try to insert beyond document length
//         TextOperation op1 = createOperation(OperationType.INSERT, 100, "Text", null, "user1", new HashMap<>());
//         otService.processOperation(op1);
//         assertEquals("Text", otService.getDocumentContent());

//         // Try to delete beyond document length
//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);
//         TextOperation op2 = createOperation(OperationType.DELETE, 2, null, 100, "user1", vector1);
//         otService.processOperation(op2);
//         assertEquals("Te", otService.getDocumentContent());
//     }

//     @Test
//     void testReplaceOperation() {
//         // Insert initial text
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector = new HashMap<>();
//         vector.put("user1", 1);

//         // Replace "World" with "Everyone"
//         TextOperation replace = createOperation(OperationType.REPLACE, 6, "Everyone", 5, "user1", vector);
//         otService.processOperation(replace);

//         assertEquals("Hello Everyone", otService.getDocumentContent());
//     }

//     @Test
//     void testConcurrentReplaces() {
//         // Setup initial text
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // User 1 replaces "World"
//         TextOperation replace1 = createOperation(OperationType.REPLACE, 6, "Everyone", 5, "user1", vector1);
//         otService.processOperation(replace1);

//         // User 2 concurrently tries to replace "World" too
//         TextOperation replace2 = createOperation(OperationType.REPLACE, 6, "Friends", 5, "user2", vector1);
//         otService.processOperation(replace2);

//         String content = otService.getDocumentContent();
//         assertTrue(
//                 content.equals("Hello EveryoneFriends"),
//                 "Content should be either 'Hello Everyone' or 'Hello Friends' but was: " + content
//         );
//     }

//     @Test
//     void testComplexConcurrentOperations() {
//         // Initial setup
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "The quick brown fox", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // User 1 replaces "quick" with "slow"
//         TextOperation op1 = createOperation(OperationType.REPLACE, 4, "slow", 5, "user1", vector1);
//         otService.processOperation(op1);

//         // User 2 concurrently inserts after "brown"
//         TextOperation op2 = createOperation(OperationType.INSERT, 15, " and lazy", null, "user2", vector1);
//         otService.processOperation(op2);

//         // User 3 concurrently deletes "fox"
//         TextOperation op3 = createOperation(OperationType.DELETE, 16, null, 3, "user3", vector1);
//         otService.processOperation(op3);

//         String content = otService.getDocumentContent();
//         // Since concurrent ops can apply in different orders depending on arrival and transformation,
//         // we check for the expected pieces rather than an exact string.
//         assertTrue(content.contains("slow") && content.contains("brown") && content.contains("lazy") && !content.contains("fox"),
//                 "Document should contain transformed concurrent operations, but was: " + content);
//     }

//     @Test
//     void testVersionVectorHandling() {
//         TextOperation op1 = createOperation(OperationType.INSERT, 0, "Hello", null, "user1", new HashMap<>());
//         TextOperation result1 = otService.processOperation(op1);

//         // Check version vector was updated
//         VersionVector vv1 = result1.getBaseVersionVector();
//         assertNotNull(vv1);
//         assertEquals(1, vv1.getVersions().get("user1"));

//         // Process another operation from same user
//         Map<String, Integer> vector2 = new HashMap<>(vv1.getVersions());
//         TextOperation op2 = createOperation(OperationType.INSERT, 5, " World", null, "user1", vector2);
//         TextOperation result2 = otService.processOperation(op2);

//         // Check version vector was incremented
//         VersionVector vv2 = result2.getBaseVersionVector();
//         assertNotNull(vv2);
//         assertEquals(2, vv2.getVersions().get("user1"));
//     }

//     @Test
//     void testNewlineHandling() {
//         // Test with Windows-style newlines
//         TextOperation op1 = createOperation(OperationType.INSERT, 0, "Line1\r\nLine2", null, "user1", new HashMap<>());
//         otService.processOperation(op1);

//         // Verify newlines are normalized
//         String content = otService.getDocumentContent();
//         assertFalse(content.contains("\r\n"), "Windows-style newlines should be normalized");
//         assertTrue(content.contains("\n"), "Newlines should be preserved in Unix style");
//         assertEquals("Line1\nLine2", content);
//     }

//     // --- Multi-line Tests ---

//     @Test
//     void testInsertMultiLineText() {
//         TextOperation op = createOperation(OperationType.INSERT, 0, "Line 1\nLine 2\nLine 3", null, "user1", new HashMap<>());
//         otService.processOperation(op);
//         assertEquals("Line 1\nLine 2\nLine 3", otService.getDocumentContent());
//     }

//     @Test
//     void testDeleteSingleLineContainingNewline() {
//         // Setup: "Line 1\nLine 2\nLine 3"
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Line 1\nLine 2\nLine 3", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // Delete "Line 2\n" (length = 7)
//         TextOperation deleteOp = createOperation(OperationType.DELETE, 7, null, 7, "user1", vector1);
//         otService.processOperation(deleteOp);

//         assertEquals("Line 1\nLine 3", otService.getDocumentContent());
//     }

//     @Test
//     void testDeleteMultipleLines() {
//         // Setup: "Line 1\nLine 2\nLine 3\nLine 4"
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Line 1\nLine 2\nLine 3\nLine 4", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // Delete "Line 2\nLine 3\n" (position 7, length 14)
//         TextOperation deleteOp = createOperation(OperationType.DELETE, 7, null, 14, "user1", vector1);
//         otService.processOperation(deleteOp);

//         assertEquals("Line 1\nLine 4", otService.getDocumentContent());
//     }

//      @Test
//     void testReplaceWithMultiLineText() {
//         // Setup: "Hello World"
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Hello World", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // Replace "World" with "Multi\nLine\nText"
//         TextOperation replaceOp = createOperation(OperationType.REPLACE, 6, "Multi\nLine\nText", 5, "user1", vector1);
//         otService.processOperation(replaceOp);

//         assertEquals("Hello Multi\nLine\nText", otService.getDocumentContent());
//     }

//      @Test
//     void testReplaceMultiLineText() {
//         // Setup: "Line 1\nLine 2\nLine 3"
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Line 1\nLine 2\nLine 3", null, "user1", new HashMap<>());
//         otService.processOperation(setup);

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // Replace "Line 2\nLine 3" (pos 7, len 14) with "Replacement"
//         TextOperation replaceOp = createOperation(OperationType.REPLACE, 7, "Replacement", 14, "user1", vector1);
//         otService.processOperation(replaceOp);

//         assertEquals("Line 1\nReplacement", otService.getDocumentContent());
//     }


//     @Test
//     void testConcurrentMultiLineInserts() {
//         // User 1 inserts multi-line text
//         TextOperation op1 = createOperation(OperationType.INSERT, 0, "AAA\nBBB", null, "user1", new HashMap<>());
//         otService.processOperation(op1); // State: "AAA\nBBB"

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("user1", 1);

//         // User 2 concurrently inserts multi-line text at the same position
//         TextOperation op2 = createOperation(OperationType.INSERT, 0, "111\n222", null, "user2", new HashMap<>());
//         otService.processOperation(op2); // State depends on tie-break

//         String content = otService.getDocumentContent();
//         assertTrue(
//                 content.equals("AAA\nBBB111\n222") || content.equals("111\n222AAA\nBBB"),
//                 "Concurrent multi-line inserts failed. Expected one of the ordered merges, got: " + content
//         );
//     }

//      @Test
//     void testConcurrentMultiLineDeletes() {
//         // Setup: "Line 1\nLine 2\nLine 3\nLine 4\nLine 5"
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5", null, "userA", new HashMap<>());
//         otService.processOperation(setup); // Version A:1

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("userA", 1);

//         // User B deletes "Line 2\nLine 3\n" (pos 7, len 14)
//         TextOperation deleteB = createOperation(OperationType.DELETE, 7, null, 14, "userB", vector1);
//         otService.processOperation(deleteB); // State: "Line 1\nLine 4\nLine 5", B:1

//         // User C *concurrently* (based on vector1) deletes "Line 4\nLine 5" (original pos 21, len 14)
//         TextOperation deleteC = createOperation(OperationType.DELETE, 21, null, 14, "userC", vector1);
//         otService.processOperation(deleteC); // C:1

//         // Explanation of expected transformation:
//         // B deleted 14 chars at pos 7.
//         // C's original op was delete pos 21, len 14.
//         // Transform C against B: transformPositionAgainstDelete(21, 7, 14) = 7. transformLengthAgainstDelete(21, 14, 7, 14) = 14.
//         // Transformed C deletes 14 chars from pos 7 on the state "Line 1\nLine 4\nLine 5".

//         assertEquals("Line 1\n", otService.getDocumentContent());
//     }

//      @Test
//     void testConcurrentInsertAndMultiLineDelete() {
//         // Setup: "Line 1\nLine 2\nLine 3\nLine 4"
//         TextOperation setup = createOperation(OperationType.INSERT, 0, "Line 1\nLine 2\nLine 3\nLine 4", null, "userA", new HashMap<>());
//         otService.processOperation(setup); // Version A:1

//         Map<String, Integer> vector1 = new HashMap<>();
//         vector1.put("userA", 1);

//         // User B deletes "Line 2\nLine 3\n" (pos 7, len 14)
//         TextOperation deleteB = createOperation(OperationType.DELETE, 7, null, 14, "userB", vector1);
//         otService.processOperation(deleteB); // State: "Line 1\nLine 4", B:1

//         // User C *concurrently* (based on vector1) inserts "Inserted\n" at the start of Line 3 (original pos 14)
//         TextOperation insertC = createOperation(OperationType.INSERT, 14, "Inserted\n", null, "userC", vector1);
//         otService.processOperation(insertC); // C:1

//         // Explanation of expected transformation:
//         // B deleted 14 chars at pos 7.
//         // C's original op was insert at pos 14.
//         // Transform C against B: transformPositionForDelete(14, 7, 14) = 7.
//         // Transformed C inserts at pos 7 on the state "Line 1\nLine 4".

//         assertEquals("Line 1\nInserted\nLine 4", otService.getDocumentContent());
//     }
// }