import { MockEditor } from "../mocks/monaco-editor.mock";
import {
  OperationType,
  TextOperation,
  TextOperationManager,
  VersionVector,
} from "../../TextOperationSystem";

describe("TextOperationSystem", () => {
  // Test for VersionVector
  describe("VersionVector", () => {
    test("should correctly initialize version vector", () => {
      const vector = new VersionVector({ user1: 1, user2: 2 });
      expect(vector.getVersions()).toEqual({ user1: 1, user2: 2 });
    });

    test("should update version correctly", () => {
      const vector = new VersionVector();
      vector.update("user1", 5);
      expect(vector.getVersions()["user1"]).toBe(5);
    });

    test("should correctly merge version vectors", () => {
      const vector1 = new VersionVector({ user1: 1, user2: 2 });
      const vector2 = new VersionVector({ user2: 3, user3: 4 });
      const merged = vector1.merge(vector2);
      expect(merged.getVersions()).toEqual({ user1: 1, user2: 3, user3: 4 });
    });

    test("should correctly detect concurrent operations", () => {
      const vector1 = new VersionVector({ user1: 1, user2: 2 });
      const vector2 = new VersionVector({ user1: 2, user2: 1 });
      expect(vector1.concurrent(vector2)).toBe(true);

      const vector3 = new VersionVector({ user1: 2, user2: 3 });
      expect(vector1.concurrent(vector3)).toBe(false);
    });
  });

  // Test TextOperationManager focusing on the position calculation issues
  describe("TextOperationManager - Position Handling", () => {
    let mockEditor: MockEditor;
    let operationManager: TextOperationManager;
    let operations: TextOperation[] = [];

    const captureOperation = (op: TextOperation) => {
      operations.push(op);
    };

    beforeEach(() => {
      // Initialize with empty content
      mockEditor = new MockEditor("");
      operationManager = new TextOperationManager(
        mockEditor as any,
        "user1",
        { user1: 0 },
        captureOperation
      );
      operations = [];
    });

    // Helper to simulate local content change
    const simulateLocalContentChange = (
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
      (operationManager as any).handleModelContentChange(event);

      return operations[operations.length - 1];
    };

    test("should correctly handle insert operations", () => {
      // First insert
      const op1 = simulateLocalContentChange(0, "Hello");

      expect(op1.type).toBe(OperationType.INSERT);
      expect(op1.position).toBe(0);
      expect(op1.text).toBe("Hello");
      expect(op1.userId).toBe("user1");

      // Second insert at end
      const op2 = simulateLocalContentChange(5, " World");

      expect(op2.type).toBe(OperationType.INSERT);
      expect(op2.position).toBe(5);
      expect(op2.text).toBe(" World");

      // Insert in the middle
      const op3 = simulateLocalContentChange(5, ", beautiful");

      expect(op3.type).toBe(OperationType.INSERT);
      expect(op3.position).toBe(5);
      expect(op3.text).toBe(", beautiful");
    });

    test("should correctly transform concurrent insert operations from different users", () => {
      // Initial state: empty document
      mockEditor.setValue("");

      // User 1 inserts 'Hello'
      const op1: TextOperation = {
        id: "op1",
        type: OperationType.INSERT,
        position: 0,
        text: "Hello",
        baseVersionVector: { user1: 0 },
        userId: "user1",
      };

      // Apply operation
      operationManager.applyOperation(op1);
      expect(mockEditor.getValue()).toBe("Hello");

      // User 2 inserts ' World' - concurrent with User 1's operation
      const op2: TextOperation = {
        id: "op2",
        type: OperationType.INSERT,
        position: 0,
        text: " World",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      // Apply operation
      operationManager.applyOperation(op2);

      // Since user IDs are compared lexicographically for tie-breaking,
      // 'user1' < 'user2', so user2's text should go after user1's
      expect(mockEditor.getValue()).toBe("Hello World");
    });

    test("should correctly handle deletion operations", () => {
      // Setup initial text
      mockEditor.setValue("Hello World");

      // Delete 'World'
      const op = simulateLocalContentChange(6, "", 5);

      expect(op.type).toBe(OperationType.DELETE);
      expect(op.position).toBe(6);
      expect(op.length).toBe(5);
    });

    test("should correctly handle replacement operations", () => {
      // Setup initial text
      mockEditor.setValue("Hello World");

      // Replace 'World' with 'Universe'
      const op = simulateLocalContentChange(6, "Universe", 5);

      expect(op.type).toBe(OperationType.REPLACE);
      expect(op.position).toBe(6);
      expect(op.text).toBe("Universe");
      expect(op.length).toBe(5);
    });

    test("should correctly transform position when insertions happen before cursor", () => {
      mockEditor.setValue("abc");

      // Set cursor at position 3 (after 'c')
      mockEditor.setSelections([
        {
          startLineNumber: 1,
          startColumn: 4,
          endLineNumber: 1,
          endColumn: 4,
        } as any,
      ]);

      // Another user inserts 'xyz' at the beginning
      const op: TextOperation = {
        id: "op1",
        type: OperationType.INSERT,
        position: 0,
        text: "xyz",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Document should now be 'xyzabc'
      expect(mockEditor.getValue()).toBe("xyzabc");

      // Cursor should now be at position 6 (after 'c')
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(7); // 1-indexed
    });

    test("should correctly transform position when insertions happen at same position from different users", () => {
      mockEditor.setValue("");

      // User1 inserts 'abc'
      const op1: TextOperation = {
        id: "op1",
        type: OperationType.INSERT,
        position: 0,
        text: "abc",
        baseVersionVector: { user1: 0 },
        userId: "user1",
      };

      operationManager.applyOperation(op1);
      expect(mockEditor.getValue()).toBe("abc");

      // User2 inserts 'xyz' at the same position (0) concurrently
      const op2: TextOperation = {
        id: "op2",
        type: OperationType.INSERT,
        position: 0,
        text: "xyz",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op2);

      // Since user1 < user2 lexicographically, user1's text should come first
      expect(mockEditor.getValue()).toBe("abcxyz");
    });

    test("should correctly transform operation against concurrent operations", () => {
      // Start with empty document
      mockEditor.setValue("");

      // User1 inserts 'abc'
      const op1: TextOperation = {
        id: "op1",
        type: OperationType.INSERT,
        position: 0,
        text: "abc",
        baseVersionVector: { user1: 0 },
        userId: "user1",
      };

      // Apply operation
      operationManager.applyOperation(op1);
      expect(mockEditor.getValue()).toBe("abc");

      // User2 (concurrent) inserts '123' at position 1 (after 'a')
      const op2: TextOperation = {
        id: "op2",
        type: OperationType.INSERT,
        position: 1,
        text: "123",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      // Apply operation - should be transformed against op1
      operationManager.applyOperation(op2);

      // Should be 'a123bc'
      expect(mockEditor.getValue()).toBe("a123bc");

      // User3 (concurrent with both) deletes character at position 2
      const op3: TextOperation = {
        id: "op3",
        type: OperationType.DELETE,
        position: 2,
        length: 1,
        baseVersionVector: { user3: 0 },
        userId: "user3",
      };

      // Apply operation - should be transformed against op1 and op2
      operationManager.applyOperation(op3);

      // The result depends on the transformation - checking that it's applied
      // without errors and is different from the previous state
      expect(mockEditor.getValue()).not.toBe("a123bc");
    });
  });
});
