//package com.codecafe.backend;
//
//import static org.junit.jupiter.api.Assertions.assertEquals;
//import static org.junit.jupiter.api.Assertions.assertTrue;
//
//import com.codecafe.backend.dto.OperationType;
//import com.codecafe.backend.dto.TextOperation;
//import com.codecafe.backend.service.OtService;
//import org.junit.jupiter.api.BeforeEach;
//import org.junit.jupiter.api.Test;
//
//public class OtServiceTest {
//
//    private OtService otService;
//
//    @BeforeEach
//    public void setup() {
//        otService = new OtService();
//    }
//
//    @Test
//    public void testInsertOperation() {
//        // Test inserting text into an empty document.
//        TextOperation insertOp = new TextOperation();
//        insertOp.setType(OperationType.INSERT);
//        insertOp.setPosition(0);
//        insertOp.setText("Hello");
//        insertOp.setVersion(0);
//        insertOp.setUserId("user1");
//
//        TextOperation result = otService.processOperation(insertOp);
//        assertEquals("Hello", otService.getDocumentContent());
//        assertEquals(1, otService.getCurrentVersion());
//        // Ensure version is updated on the operation
//        assertEquals(1, result.getVersion());
//    }
//
//    @Test
//    public void testDeleteOperation() {
//        // Prepopulate the document with "Hello World"
//        TextOperation initOp = new TextOperation();
//        initOp.setType(OperationType.INSERT);
//        initOp.setPosition(0);
//        initOp.setText("Hello World");
//        initOp.setVersion(0);
//        initOp.setUserId("user1");
//        otService.processOperation(initOp);
//
//        // Delete " World" from "Hello World"
//        TextOperation deleteOp = new TextOperation();
//        deleteOp.setType(OperationType.DELETE);
//        deleteOp.setPosition(5);
//        deleteOp.setLength(6);
//        deleteOp.setVersion(1);  // based on version after initOp
//        deleteOp.setUserId("user2");
//
//        otService.processOperation(deleteOp);
//        assertEquals("Hello", otService.getDocumentContent());
//        assertEquals(2, otService.getCurrentVersion());
//    }
//
//    @Test
//    public void testReplaceOperation() {
//        // Prepopulate with "Hello World"
//        TextOperation initOp = new TextOperation();
//        initOp.setType(OperationType.INSERT);
//        initOp.setPosition(0);
//        initOp.setText("Hello World");
//        initOp.setVersion(0);
//        initOp.setUserId("user1");
//        otService.processOperation(initOp);
//
//        // Replace "World" with "Java"
//        TextOperation replaceOp = new TextOperation();
//        replaceOp.setType(OperationType.REPLACE);
//        replaceOp.setPosition(6);
//        replaceOp.setLength(5);
//        replaceOp.setText("Java");
//        replaceOp.setVersion(1);  // based on version after initOp
//        replaceOp.setUserId("user2");
//
//        otService.processOperation(replaceOp);
//        assertEquals("Hello Java", otService.getDocumentContent());
//        assertEquals(2, otService.getCurrentVersion());
//    }
//
//    @Test
//    public void testTransformationWithConcurrentOps() {
//        // User1 inserts "Hello"
//        TextOperation op1 = new TextOperation();
//        op1.setType(OperationType.INSERT);
//        op1.setPosition(0);
//        op1.setText("Hello");
//        op1.setVersion(0);
//        op1.setUserId("user1");
//        otService.processOperation(op1);
//
//        // User2 concurrently inserts "World" at the beginning based on version 0.
//        TextOperation op2 = new TextOperation();
//        op2.setType(OperationType.INSERT);
//        op2.setPosition(0);
//        op2.setText("World ");
//        op2.setVersion(0);  // outdated version
//        op2.setUserId("user2");
//
//        // Process op2: It should be transformed against op1.
//        TextOperation resultOp2 = otService.processOperation(op2);
//        // Depending on tie-breaking, op2 might have been shifted
//        String content = otService.getDocumentContent();
//        // Expected result: "World Hello" or "HelloWorld " based on transformation logic.
//        // In our implementation, an insert from another user at the same position shifts the operation.
//        assertTrue(content.equals("HelloWorld ") || content.equals("World Hello"));
//    }
//
//    @Test
//    public void testNoTransformationForSameUser() {
//        // User1 performs two operations.
//        TextOperation op1 = new TextOperation();
//        op1.setType(OperationType.INSERT);
//        op1.setPosition(0);
//        op1.setText("Hello");
//        op1.setVersion(0);
//        op1.setUserId("user1");
//        otService.processOperation(op1);
//
//        // Second operation from same user based on an outdated version.
//        TextOperation op2 = new TextOperation();
//        op2.setType(OperationType.INSERT);
//        op2.setPosition(5);
//        op2.setText(" World");
//        op2.setVersion(0);  // same version as op1's base version
//        op2.setUserId("user1");
//
//        // Since same-user operations should not transform each other, the second op is applied as is.
//        TextOperation resultOp2 = otService.processOperation(op2);
//        assertEquals("Hello World", otService.getDocumentContent());
//    }
//}
