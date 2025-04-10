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
      // Simulate op1 being pending (created locally but not yet acknowledged)
      (operationManager as any).pendingOperations.set(op1.id, op1);
      (operationManager as any).incrementLocalVersion(); // user1: 1
      mockEditor.setValue("abc"); // Update mock editor state

      // User2 inserts 'xyz' concurrently at position 0
      const op2: TextOperation = {
        id: "op2",
        type: OperationType.INSERT,
        position: 0,
        text: "xyz",
        baseVersionVector: { user2: 0 }, // Based on initial empty state
        userId: "user2",
      };

      // Apply User2's operation
      operationManager.applyOperation(op2);

      // Expected transformation: op2 is transformed against op1
      // transformPosition(0, 0, 3, true, "user2", "user1") -> 3 (since user2 > user1)
      // Expected state: "abcxyz"
      expect(mockEditor.getValue()).toBe("abcxyz");
    });

    // --- Multi-line Tests ---

    test("should handle local multi-line insert", () => {
      const op = simulateLocalContentChange(0, "Line1\nLine2");
      expect(op.type).toBe(OperationType.INSERT);
      expect(op.position).toBe(0);
      expect(op.text).toBe("Line1\nLine2");
    });

    test("should handle local multi-line delete", () => {
      mockEditor.setValue("Line1\nLine2\nLine3");
      // Delete "Line2\n" (pos 6, len 6)
      const op = simulateLocalContentChange(6, "", 6);
      expect(op.type).toBe(OperationType.DELETE);
      expect(op.position).toBe(6);
      expect(op.length).toBe(6);
    });

    test("should handle local multi-line replace", () => {
      mockEditor.setValue("Line1\nLine2\nLine3");
      // Replace "Line2\nLine3" (pos 6, len 12) with "Replacement"
      const op = simulateLocalContentChange(6, "Replacement", 12);
      expect(op.type).toBe(OperationType.REPLACE);
      expect(op.position).toBe(6);
      expect(op.text).toBe("Replacement");
      expect(op.length).toBe(12);
    });

    test("should apply remote multi-line insert", () => {
      mockEditor.setValue("Existing");
      const op: TextOperation = {
        id: "op-remote-ml-ins",
        type: OperationType.INSERT,
        position: 8,
        text: "\nNewLine1\nNewLine2",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };
      operationManager.applyOperation(op);
      expect(mockEditor.getValue()).toBe("Existing\nNewLine1\nNewLine2");
    });

    test("should apply remote multi-line delete", () => {
      mockEditor.setValue("Line1\nLine2\nLine3\nLine4");
      // Delete "Line2\nLine3\n" (pos 6, len 12)
      const op: TextOperation = {
        id: "op-remote-ml-del",
        type: OperationType.DELETE,
        position: 6,
        length: 12,
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };
      operationManager.applyOperation(op);
      expect(mockEditor.getValue()).toBe("Line1\nLine4");
    });

    test("should apply remote multi-line replace", () => {
      mockEditor.setValue("Line1\nLine2\nLine3");
      // Replace "Line2\nLine3" (pos 6, len 12) with "NewContent"
      const op: TextOperation = {
        id: "op-remote-ml-rep",
        type: OperationType.REPLACE,
        position: 6,
        length: 12,
        text: "NewContent",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };
      operationManager.applyOperation(op);
      expect(mockEditor.getValue()).toBe("Line1\nNewContent");
    });

    test("should transform remote multi-line insert against local pending insert", () => {
      // Local pending op: insert "LocalInsert " at pos 0
      mockEditor.setValue("LocalInsert ");
      const pendingOp: TextOperation = {
        id: "local-pending",
        type: OperationType.INSERT,
        position: 0,
        text: "LocalInsert ",
        baseVersionVector: { user1: 0 },
        userId: "user1",
      };
      (operationManager as any).pendingOperations.set(pendingOp.id, pendingOp);
      (operationManager as any).incrementLocalVersion(); // user1: 1

      // Remote op: insert "Remote\nLines" at pos 0 (concurrently)
      const remoteOp: TextOperation = {
        id: "remote-ml",
        type: OperationType.INSERT,
        position: 0,
        text: "Remote\nLines",
        baseVersionVector: { user2: 0 }, // Based on empty state
        userId: "user2",
      };

      operationManager.applyOperation(remoteOp);

      // Expected: remoteOp transformed against pendingOp.
      // transformPosition(0, 0, 12, true, "user2", "user1") -> 12 (user2 > user1)
      // Expected value: "LocalInsert Remote\nLines"
      expect(mockEditor.getValue()).toBe("LocalInsert Remote\nLines");
    });

    test("should transform remote multi-line delete against local pending insert", () => {
      mockEditor.setValue("LocalInsert Line1\nLine2\nLine3");
      const initialContent = "Line1\nLine2\nLine3";
      const insertOffset = "LocalInsert ".length; // 12

      // Local pending op: insert "LocalInsert " at pos 0
      const pendingOp: TextOperation = {
        id: "local-pending-ins",
        type: OperationType.INSERT,
        position: 0,
        text: "LocalInsert ",
        baseVersionVector: { user1: 0 },
        userId: "user1",
      };
      (operationManager as any).pendingOperations.set(pendingOp.id, pendingOp);
      (operationManager as any).incrementLocalVersion(); // user1: 1

      // Remote op: delete "Line2\nLine3" (original pos 6, len 12)
      const remoteOp: TextOperation = {
        id: "remote-ml-del",
        type: OperationType.DELETE,
        position: 6,
        length: 12,
        baseVersionVector: { user2: 0 }, // Based on initial content state
        userId: "user2",
      };

      operationManager.applyOperation(remoteOp);

      // Expected: remoteOp transformed against pendingOp.
      // transformPositionAgainstInsert(6, 0, 12) -> 6 + 12 = 18
      // transformLengthForInsert(6, 12, 0, 12) -> 12 (insert is before delete)
      // Transformed remoteOp: delete pos 18, len 12
      // Expected value: "LocalInsert Line1\n"
      expect(mockEditor.getValue()).toBe("LocalInsert Line1\n");
    });

    test("should transform local pending multi-line delete against remote insert", () => {
      // Initial state: "Line1\nLine2\nLine3\nLine4"
      mockEditor.setValue("Line1\nLine2\nLine3\nLine4");

      // Local pending op: delete "Line2\nLine3\n" (pos 6, len 12)
      const pendingOp: TextOperation = {
        id: "local-pending-del",
        type: OperationType.DELETE,
        position: 6,
        length: 12,
        baseVersionVector: { user1: 0 },
        userId: "user1",
      };
      (operationManager as any).pendingOperations.set(pendingOp.id, pendingOp);
      (operationManager as any).incrementLocalVersion(); // user1: 1
      mockEditor.setValue("Line1\nLine4"); // Reflect local delete

      // Remote op: insert "RemoteInsert " at pos 0 (concurrently)
      const remoteOp: TextOperation = {
        id: "remote-ins",
        type: OperationType.INSERT,
        position: 0,
        text: "RemoteInsert ",
        baseVersionVector: { user2: 0 }, // Based on initial content state
        userId: "user2",
      };

      // Apply remote op. It will be transformed against the *pending* op.
      operationManager.applyOperation(remoteOp);

      // Expected transformation of remoteOp against pendingOp:
      // transformPosition(0, 6, undefined, false, ...) -> 0 (no change as insert is before delete)
      // The remote insert applies at pos 0.
      // Expected document state after remote op: "RemoteInsert Line1\nLine4"
      expect(mockEditor.getValue()).toBe("RemoteInsert Line1\nLine4");

      // Now, imagine the ACK for the pending delete comes back, or we send it.
      // The key is that the remote op was correctly applied relative to the local state *before* the remote op arrived.
    });
  });
});
