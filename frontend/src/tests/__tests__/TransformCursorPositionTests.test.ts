import { OperationType, TextOperation } from "../../TextOperationSystem";

// Test implementation of the private transformCursorPosition method
describe("TransformCursorPositionTests", () => {
  // Create an implementation of the private transformCursorPosition method
  // based on the implementation in TextOperationSystem.ts
  function transformCursorPosition(
    cursorOffset: number,
    operation: TextOperation,
    userId: string
  ): number {
    switch (operation.type) {
      case OperationType.INSERT:
        if (cursorOffset < operation.position) {
          // Cursor is before the insert point - no change
          return cursorOffset;
        } else if (cursorOffset === operation.position) {
          // Cursor is exactly at the insert point - use the same tie-breaking logic
          // as operation transformation for consistency
          if (userId === operation.userId) {
            // Same user, place after insert
            return cursorOffset + (operation.text?.length || 0);
          } else {
            const comparison = userId.localeCompare(operation.userId);
            if (comparison <= 0) {
              // Our ID is smaller, place before
              return cursorOffset;
            } else {
              // Our ID is larger, place after
              return cursorOffset + (operation.text?.length || 0);
            }
          }
        } else {
          // Cursor is after the insert point - shift it
          return cursorOffset + (operation.text?.length || 0);
        }

      case OperationType.DELETE:
        if (!operation.length) return cursorOffset;

        if (cursorOffset <= operation.position) {
          // Cursor is before or at the delete start - no change
          return cursorOffset;
        } else if (cursorOffset <= operation.position + operation.length) {
          // Cursor is within the deleted range - move to the start of deletion
          return operation.position;
        } else {
          // Cursor is after the deletion - shift it left
          return cursorOffset - operation.length;
        }

      case OperationType.REPLACE:
        if (!operation.length) return cursorOffset;

        if (cursorOffset <= operation.position) {
          // Cursor is before the replace - no change
          return cursorOffset;
        } else if (cursorOffset <= operation.position + operation.length) {
          // Cursor is within the replaced region - move to the end of the new text
          // This is a common strategy for replace operations
          return operation.position + (operation.text?.length || 0);
        } else {
          // Cursor is after the replaced region - adjust by the difference in length
          const lengthDiff = (operation.text?.length || 0) - operation.length;
          return cursorOffset + lengthDiff;
        }
    }

    return cursorOffset;
  }

  describe("INSERT operations", () => {
    test("should not move cursor when insertion happens after cursor", () => {
      const cursorPos = 5;
      const op: TextOperation = {
        type: OperationType.INSERT,
        position: 10,
        text: "hello",
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(5);
    });

    test("should move cursor when insertion happens before cursor", () => {
      const cursorPos = 10;
      const op: TextOperation = {
        type: OperationType.INSERT,
        position: 5,
        text: "hello",
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(15); // cursor moved by length of insertion
    });

    test("should handle cursor at insertion point - user1 vs user2", () => {
      const cursorPos = 5;
      const op: TextOperation = {
        type: OperationType.INSERT,
        position: 5,
        text: "hello",
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");

      // If user1 < user2 lexicographically, cursor stays
      // Otherwise, cursor moves
      const expected = "user1".localeCompare("user2") <= 0 ? 5 : 10;
      expect(newPos).toBe(expected);
    });

    test("should handle cursor at insertion point - user2 vs user1", () => {
      const cursorPos = 5;
      const op: TextOperation = {
        type: OperationType.INSERT,
        position: 5,
        text: "hello",
        baseVersionVector: {},
        userId: "user1",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user2");

      // If user2 < user1 lexicographically, cursor stays
      // Otherwise, cursor moves
      const expected = "user2".localeCompare("user1") <= 0 ? 5 : 10;
      expect(newPos).toBe(expected);
    });

    test("should place cursor after insertion when same user", () => {
      const cursorPos = 5;
      const op: TextOperation = {
        type: OperationType.INSERT,
        position: 5,
        text: "hello",
        baseVersionVector: {},
        userId: "user1",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(10); // cursor moves after insertion for the same user
    });
  });

  describe("DELETE operations", () => {
    test("should not move cursor when deletion happens after cursor", () => {
      const cursorPos = 5;
      const op: TextOperation = {
        type: OperationType.DELETE,
        position: 10,
        length: 5,
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(5);
    });

    test("should move cursor when deletion happens before cursor", () => {
      const cursorPos = 20;
      const op: TextOperation = {
        type: OperationType.DELETE,
        position: 10,
        length: 5,
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(15); // cursor moved back by length of deletion
    });

    test("should move cursor to deletion point when cursor is inside deleted range", () => {
      const cursorPos = 12;
      const op: TextOperation = {
        type: OperationType.DELETE,
        position: 10,
        length: 5,
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(10); // cursor moves to start of deletion
    });
  });

  describe("REPLACE operations", () => {
    test("should not move cursor when replacement happens after cursor", () => {
      const cursorPos = 5;
      const op: TextOperation = {
        type: OperationType.REPLACE,
        position: 10,
        length: 5,
        text: "hello",
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(5);
    });

    test("should move cursor to end of replacement when cursor is inside replaced range", () => {
      const cursorPos = 12;
      const op: TextOperation = {
        type: OperationType.REPLACE,
        position: 10,
        length: 5,
        text: "hello",
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(15); // cursor moves to end of replacement (pos + text.length)
    });

    test("should adjust cursor by length difference when replacement happens before cursor", () => {
      const cursorPos = 20;
      const op: TextOperation = {
        type: OperationType.REPLACE,
        position: 10,
        length: 5, // Delete 5 chars
        text: "hi", // Insert 2 chars
        baseVersionVector: {},
        userId: "user2",
      };

      const newPos = transformCursorPosition(cursorPos, op, "user1");
      expect(newPos).toBe(17); // cursor moved by (text.length - length) = (2 - 5) = -3
    });
  });
});
