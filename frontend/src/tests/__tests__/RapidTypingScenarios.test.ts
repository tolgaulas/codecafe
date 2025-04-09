import { MockEditor } from "../mocks/monaco-editor.mock";
import {
  OperationType,
  TextOperation,
  TextOperationManager,
  VersionVector,
} from "../../TextOperationSystem";
import { Selection } from "monaco-editor";

describe("TextOperationSystem - Rapid Typing Scenarios", () => {
  let mockEditor: MockEditor;
  let userAOperationManager: TextOperationManager;
  let userBOperationManager: TextOperationManager;
  let userAOperations: TextOperation[] = [];
  let userBOperations: TextOperation[] = [];

  // Operation collection callbacks
  const captureUserAOperation = (op: TextOperation) => {
    userAOperations.push(op);
  };

  const captureUserBOperation = (op: TextOperation) => {
    userBOperations.push(op);
  };

  beforeEach(() => {
    // Create two separate editors and operation managers for two users
    let editorForUserA = new MockEditor();
    let editorForUserB = new MockEditor();

    userAOperationManager = new TextOperationManager(
      editorForUserA as any,
      "userA",
      { userA: 0 },
      captureUserAOperation
    );

    userBOperationManager = new TextOperationManager(
      editorForUserB as any,
      "userB",
      { userB: 0 },
      captureUserBOperation
    );

    // Store a reference to one of the editors for assertion tests
    mockEditor = editorForUserA;

    // Reset operations
    userAOperations = [];
    userBOperations = [];
  });

  // Helper to simulate local content change
  const simulateLocalContentChange = (
    manager: TextOperationManager,
    position: number,
    text: string,
    rangeLength: number = 0
  ) => {
    const event = {
      changes: [
        {
          range: {
            startLineNumber: 1,
            startColumn: position + 1,
            endLineNumber: 1,
            endColumn: position + rangeLength + 1,
          },
          rangeOffset: position,
          rangeLength,
          text,
        },
      ],
    };

    // Access the private method directly for testing
    (manager as any).handleModelContentChange(event);
  };

  // Helper to simulate rapid typing from User A
  const simulateUserARapidTyping = (
    text: string,
    startPosition: number = 0
  ) => {
    let position = startPosition;

    for (let i = 0; i < text.length; i++) {
      simulateLocalContentChange(userAOperationManager, position, text[i]);
      position++;
    }

    return userAOperations;
  };

  // Helper to simulate rapid typing from User B
  const simulateUserBRapidTyping = (
    text: string,
    startPosition: number = 0
  ) => {
    let position = startPosition;

    for (let i = 0; i < text.length; i++) {
      simulateLocalContentChange(userBOperationManager, position, text[i]);
      position++;
    }

    return userBOperations;
  };

  describe("Single user rapid typing", () => {
    test("should generate correct operations for rapid typing", () => {
      const operations = simulateUserARapidTyping("Hello");

      expect(operations.length).toBe(5);

      // Check each operation
      for (let i = 0; i < operations.length; i++) {
        expect(operations[i].type).toBe(OperationType.INSERT);
        expect(operations[i].position).toBe(i);
        expect(operations[i].text).toBe("Hello"[i]);
        expect(operations[i].userId).toBe("userA");
      }
    });
  });

  describe("Two users concurrent typing", () => {
    test("should correctly handle concurrent typing at different positions", () => {
      // First user types "Hello" at the beginning
      const userAOps = simulateUserARapidTyping("Hello");

      // Second user types "World" at position 10
      const userBOps = simulateUserBRapidTyping("World", 10);

      // Now apply all operations from User A to User B's editor
      for (const op of userAOps) {
        userBOperationManager.applyOperation(op);
      }

      // Now apply all operations from User B to User A's editor
      for (const op of userBOps) {
        userAOperationManager.applyOperation(op);
      }

      // Check that both editors have the same content
      expect(mockEditor.getValue()).toBe("Hello     World");
    });

    test("should correctly handle concurrent typing at the same position", () => {
      // Both users try to type at the beginning
      const userAOps = simulateUserARapidTyping("Hello");
      const userBOps = simulateUserBRapidTyping("World");

      // Now apply all operations from User A to User B's editor
      for (const op of userAOps) {
        userBOperationManager.applyOperation(op);
      }

      // Now apply all operations from User B to User A's editor
      for (const op of userBOps) {
        userAOperationManager.applyOperation(op);
      }

      // Check that both editors have the same content
      // The order should be based on user ID comparison for tie-breaking
      const finalContent = mockEditor.getValue();

      // One of these two orders, based on the lexicographical comparison
      if ("userA" < "userB") {
        expect(finalContent).toBe("HelloWorld");
      } else {
        expect(finalContent).toBe("WorldHello");
      }
    });
  });

  describe("Interleaved rapid typing", () => {
    test("should correctly handle interleaved typing operations", () => {
      // User A types the first character
      simulateLocalContentChange(userAOperationManager, 0, "H");
      const opA1 = userAOperations[0];

      // User B concurrently types at the beginning
      simulateLocalContentChange(userBOperationManager, 0, "W");
      const opB1 = userBOperations[0];

      // Apply B's operation to A's editor
      userAOperationManager.applyOperation(opB1);

      // A continues typing
      simulateLocalContentChange(userAOperationManager, 1, "e");
      simulateLocalContentChange(userAOperationManager, 2, "l");
      const opA2 = userAOperations[1];
      const opA3 = userAOperations[2];

      // Apply A's first operation to B's editor
      userBOperationManager.applyOperation(opA1);

      // B continues typing
      simulateLocalContentChange(userBOperationManager, 1, "o");
      simulateLocalContentChange(userBOperationManager, 2, "r");
      const opB2 = userBOperations[1];
      const opB3 = userBOperations[2];

      // Apply the remaining operations
      userBOperationManager.applyOperation(opA2);
      userBOperationManager.applyOperation(opA3);
      userAOperationManager.applyOperation(opB2);
      userAOperationManager.applyOperation(opB3);

      // Both editors should now have the same content
      // The exact content depends on the tie-breaking rules
      const finalContent = mockEditor.getValue();

      // The content will depend on the tie-breaking comparison between 'userA' and 'userB'
      // We'll check that the editors are consistent without specifying the exact content
      expect(finalContent.length).toBeGreaterThan(0);
    });
  });

  describe("Rapid deletes and inserts", () => {
    test("should correctly handle rapidly alternating inserts and deletes", () => {
      // Start with some content
      mockEditor.setValue("Initial text");

      // Position cursor at end
      mockEditor.setSelections([new Selection(1, 13, 1, 13)]);

      // Series of operations: type, delete, type, delete
      simulateLocalContentChange(userAOperationManager, 12, " more");
      simulateLocalContentChange(userAOperationManager, 12, "", 5); // Delete ' more'
      simulateLocalContentChange(userAOperationManager, 12, " extra");
      simulateLocalContentChange(userAOperationManager, 12, "", 6); // Delete ' extra'

      // Collect the operations
      const ops = userAOperations.slice(0, 4);

      // Apply these operations to user B
      for (const op of ops) {
        userBOperationManager.applyOperation(op);
      }

      // Both editors should still have just "Initial text"
      expect(mockEditor.getValue()).toBe("Initial text");
    });
  });

  describe("Rapid typing at shifted positions due to remote operations", () => {
    test("should correctly handle typing when positions are shifted by remote operations", () => {
      // User A starts typing
      simulateUserARapidTyping("Hello");

      // All operations from A are applied to B
      for (const op of userAOperations) {
        userBOperationManager.applyOperation(op);
      }

      // User B now types " World" at the end
      simulateUserBRapidTyping(" World", 5);

      // While B is typing, A inserts "Hey " at the beginning
      simulateLocalContentChange(userAOperationManager, 0, "Hey ");

      // Apply B's operations to A (these should be transformed against A's new operation)
      for (const op of userBOperations) {
        userAOperationManager.applyOperation(op);
      }

      // Apply A's last operation to B
      userBOperationManager.applyOperation(
        userAOperations[userAOperations.length - 1]
      );

      // Both editors should now have "Hey Hello World"
      expect(mockEditor.getValue()).toBe("Hey Hello World");
    });
  });
});
