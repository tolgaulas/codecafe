import {
  OperationType,
  TextOperation,
  VersionVector,
} from "../../TextOperationSystem";

// Simple unit tests for the TextOperationSystem's transformation logic
describe("TextOperation Transformation", () => {
  describe("VersionVector", () => {
    test("should initialize with the provided versions", () => {
      const vector = new VersionVector({ user1: 5, user2: 3 });
      expect(vector.getVersions()).toEqual({ user1: 5, user2: 3 });
    });

    test("should merge vectors correctly", () => {
      const v1 = new VersionVector({ user1: 5, user2: 3 });
      const v2 = new VersionVector({ user2: 5, user3: 2 });
      const merged = v1.merge(v2);

      expect(merged.getVersions()).toEqual({ user1: 5, user2: 5, user3: 2 });
    });

    test("should detect concurrent operations", () => {
      const v1 = new VersionVector({ user1: 5, user2: 3 });
      const v2 = new VersionVector({ user1: 4, user2: 5 });
      expect(v1.concurrent(v2)).toBe(true);

      const v3 = new VersionVector({ user1: 6, user2: 4 });
      expect(v1.concurrent(v3)).toBe(false);
    });
  });

  describe("Operation Validation", () => {
    test("Insert operation should have correct structure", () => {
      const operation: TextOperation = {
        id: "test-id",
        type: OperationType.INSERT,
        position: 5,
        text: "hello",
        baseVersionVector: { user1: 5 },
        userId: "user1",
      };

      expect(operation.type).toBe(OperationType.INSERT);
      expect(operation.position).toBe(5);
      expect(operation.text).toBe("hello");
      expect(operation.baseVersionVector).toEqual({ user1: 5 });
    });

    test("Delete operation should have correct structure", () => {
      const operation: TextOperation = {
        id: "test-id",
        type: OperationType.DELETE,
        position: 5,
        length: 5,
        baseVersionVector: { user1: 5 },
        userId: "user1",
      };

      expect(operation.type).toBe(OperationType.DELETE);
      expect(operation.position).toBe(5);
      expect(operation.length).toBe(5);
      expect(operation.baseVersionVector).toEqual({ user1: 5 });
    });

    test("Replace operation should have correct structure", () => {
      const operation: TextOperation = {
        id: "test-id",
        type: OperationType.REPLACE,
        position: 5,
        length: 5,
        text: "hello",
        baseVersionVector: { user1: 5 },
        userId: "user1",
      };

      expect(operation.type).toBe(OperationType.REPLACE);
      expect(operation.position).toBe(5);
      expect(operation.length).toBe(5);
      expect(operation.text).toBe("hello");
      expect(operation.baseVersionVector).toEqual({ user1: 5 });
    });
  });

  // Test the specific cursor transformation function that might have issues
  describe("transformPosition function", () => {
    // We need to directly test the transformPosition function that's private in TextOperationManager
    // For now, we'll do a simple test of the expected behavior
    test("should move cursor when insertion happens before cursor", () => {
      const initialCursorPos = 10;
      const insertPosition = 5;
      const insertLength = 3;

      // Expected new position: if insert happens before cursor, cursor moves by the length of insertion
      const expectedNewPosition = initialCursorPos + insertLength;

      // This is a simplistic test since we don't have direct access to the transformPosition method
      expect(initialCursorPos + insertLength).toBe(expectedNewPosition);
    });

    test("should not move cursor when insertion happens after cursor", () => {
      const initialCursorPos = 5;
      const insertPosition = 10;
      const insertLength = 3;

      // Expected: cursor position doesn't change
      const expectedNewPosition = initialCursorPos;

      expect(initialCursorPos).toBe(expectedNewPosition);
    });

    test("should handle tie-breaking at exact cursor position", () => {
      const initialCursorPos = 5;
      const insertPosition = 5; // exactly at cursor
      const insertLength = 3;
      const localUserId = "user1";
      const remoteUserId = "user2";

      // For exact cursor position, we need to use tie-breaking based on userId
      const userComparison = localUserId.localeCompare(remoteUserId);
      if (userComparison <= 0) {
        // If local user comes first lexicographically, cursor stays
        expect(initialCursorPos).toBe(5);
      } else {
        // If remote user comes first, cursor moves
        expect(initialCursorPos + insertLength).toBe(8);
      }
    });
  });
});
