import { MockEditor } from "../mocks/monaco-editor.mock";
import {
  OperationType,
  TextOperation,
  TextOperationManager,
  VersionVector,
} from "../../TextOperationSystem";
import { Selection } from "monaco-editor";

describe("TextOperationSystem - Cursor Position Handling", () => {
  let mockEditor: MockEditor;
  let operationManager: TextOperationManager;
  let capturedOperations: TextOperation[] = [];

  const captureOperation = (op: TextOperation) => {
    capturedOperations.push(op);
  };

  beforeEach(() => {
    mockEditor = new MockEditor();
    operationManager = new TextOperationManager(
      mockEditor as any,
      "user1",
      { user1: 0 },
      captureOperation
    );
    capturedOperations = [];
  });

  describe("Cursor transformation with insert operations", () => {
    test("cursor should remain at same position when insertion happens after cursor", () => {
      // Setup: place cursor at position 3 with "Hello" text
      mockEditor.setValue("Hello");
      mockEditor.setSelections([new Selection(1, 4, 1, 4)]); // After 'Hel'

      // Apply an insert operation from another user after the cursor
      const op: TextOperation = {
        id: "test-insert-after",
        type: OperationType.INSERT,
        position: 5, // After 'Hello'
        text: " World",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hello World");

      // Check cursor position is still at the same position
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(4); // 1-indexed, still after 'Hel'
    });

    test("cursor should move when insertion happens before cursor", () => {
      // Setup: place cursor at position 3 with "Hello" text
      mockEditor.setValue("Hello");
      mockEditor.setSelections([new Selection(1, 4, 1, 4)]); // After 'Hel'

      // Apply an insert operation from another user before the cursor
      const op: TextOperation = {
        id: "test-insert-before",
        type: OperationType.INSERT,
        position: 0, // At the beginning
        text: "Hey ",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hey Hello");

      // Check cursor position is moved by the length of insertion
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(8); // 4 + 4 = 8 (1-indexed, now after 'Hey Hel')
    });

    test("cursor at exact insertion point should move based on user ID comparison", () => {
      // Setup: place cursor after first character
      mockEditor.setValue("Hello");
      mockEditor.setSelections([new Selection(1, 2, 1, 2)]); // After 'H'

      // User2 (lexicographically > user1) inserts at cursor
      const op1: TextOperation = {
        id: "test-insert-at-cursor-1",
        type: OperationType.INSERT,
        position: 1, // After 'H'
        text: "i",
        baseVersionVector: { user2: 0 },
        userId: "user2", // user2 > user1
      };

      operationManager.applyOperation(op1);

      // Since user2 > user1, the cursor should move
      let selections = mockEditor.getSelections();
      expect(mockEditor.getValue()).toBe("Hiello");
      expect(selections[0].startColumn).toBe(3); // Cursor moved

      // Reset for next test
      mockEditor.setValue("Hello");
      mockEditor.setSelections([new Selection(1, 2, 1, 2)]); // After 'H'

      // User0 (lexicographically < user1) inserts at cursor
      const op2: TextOperation = {
        id: "test-insert-at-cursor-2",
        type: OperationType.INSERT,
        position: 1, // After 'H'
        text: "i",
        baseVersionVector: { user0: 0 },
        userId: "user0", // user0 < user1
      };

      operationManager.applyOperation(op2);

      // Since user0 < user1, the cursor should stay
      selections = mockEditor.getSelections();
      expect(mockEditor.getValue()).toBe("Hiello");
      expect(selections[0].startColumn).toBe(2); // Cursor didn't move
    });
  });

  describe("Cursor transformation with delete operations", () => {
    test("cursor should remain at same position when deletion happens after cursor", () => {
      // Setup: place cursor in the middle
      mockEditor.setValue("Hello World");
      mockEditor.setSelections([new Selection(1, 4, 1, 4)]); // After 'Hel'

      // Delete text after cursor position
      const op: TextOperation = {
        id: "test-delete-after",
        type: OperationType.DELETE,
        position: 5, // Delete ' World' starting after 'Hello'
        length: 6,
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hello");

      // Check cursor position remains the same
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(4); // Still after 'Hel'
    });

    test("cursor should move to deletion start when inside deleted range", () => {
      // Setup: place cursor inside the "World" part
      mockEditor.setValue("Hello World");
      mockEditor.setSelections([new Selection(1, 8, 1, 8)]); // After 'Hello W'

      // Delete "World"
      const op: TextOperation = {
        id: "test-delete-containing-cursor",
        type: OperationType.DELETE,
        position: 6, // Start of " World"
        length: 6,
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hello");

      // Check cursor moved to deletion point
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(7); // After 'Hello'
    });

    test("cursor should move back when deletion happens before cursor", () => {
      // Setup: place cursor at the end
      mockEditor.setValue("Hello World");
      mockEditor.setSelections([new Selection(1, 12, 1, 12)]); // After 'Hello World'

      // Delete "Hello "
      const op: TextOperation = {
        id: "test-delete-before-cursor",
        type: OperationType.DELETE,
        position: 0,
        length: 6,
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("World");

      // Check cursor moved back by the length of deletion
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(6); // After 'World'
    });
  });

  describe("Cursor transformation with replace operations", () => {
    test("cursor should remain at same position when replacement happens after cursor", () => {
      // Setup: place cursor after "Hello"
      mockEditor.setValue("Hello World");
      mockEditor.setSelections([new Selection(1, 6, 1, 6)]); // After 'Hello'

      // Replace "World" with "Universe"
      const op: TextOperation = {
        id: "test-replace-after",
        type: OperationType.REPLACE,
        position: 6,
        length: 5,
        text: "Universe",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hello Universe");

      // Check cursor position is still the same
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(6); // Still after 'Hello'
    });

    test("cursor should move to end of replacement when inside replaced range", () => {
      // Setup: place cursor in the middle of "World"
      mockEditor.setValue("Hello World");
      mockEditor.setSelections([new Selection(1, 9, 1, 9)]); // After 'Hello Wo'

      // Replace "World" with "Universe"
      const op: TextOperation = {
        id: "test-replace-containing-cursor",
        type: OperationType.REPLACE,
        position: 6,
        length: 5,
        text: "Universe",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hello Universe");

      // Check cursor moved to the end of replaced text
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(14); // After 'Hello Universe'
    });

    test("cursor should adjust position when replacement happens before cursor", () => {
      // Setup: place cursor at the end
      mockEditor.setValue("Hello World");
      mockEditor.setSelections([new Selection(1, 12, 1, 12)]); // After 'Hello World'

      // Replace "Hello" with "Hi"
      const op: TextOperation = {
        id: "test-replace-before-cursor",
        type: OperationType.REPLACE,
        position: 0,
        length: 5,
        text: "Hi",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      operationManager.applyOperation(op);

      // Check text is updated correctly
      expect(mockEditor.getValue()).toBe("Hi World");

      // Cursor should move left by the net change in length (5 - 2 = 3)
      const selections = mockEditor.getSelections();
      expect(selections[0].startColumn).toBe(9); // After 'Hi World'
    });
  });

  describe("Multiple concurrent operations", () => {
    test("cursor should transform correctly with multiple concurrent operations", () => {
      // Setup initial text and cursor position
      mockEditor.setValue("Hello beautiful world");
      mockEditor.setSelections([new Selection(1, 7, 1, 7)]); // After 'Hello '

      // Concurrent operation 1: Insert at beginning
      const op1: TextOperation = {
        id: "concurrent-1",
        type: OperationType.INSERT,
        position: 0,
        text: "Say: ",
        baseVersionVector: { user2: 0 },
        userId: "user2",
      };

      // Concurrent operation 2: Delete 'beautiful '
      const op2: TextOperation = {
        id: "concurrent-2",
        type: OperationType.DELETE,
        position: 6,
        length: 10,
        baseVersionVector: { user3: 0 },
        userId: "user3",
      };

      // Apply first operation
      operationManager.applyOperation(op1);
      expect(mockEditor.getValue()).toBe("Say: Hello beautiful world");

      // First cursor transformation
      let selections = mockEditor.getSelections();
      const afterFirstOp = selections[0].startColumn;

      // Apply second operation
      operationManager.applyOperation(op2);

      // Final text and cursor position
      selections = mockEditor.getSelections();
      expect(mockEditor.getValue()).toBe("Say: Hello world");

      // Verify the cursor has moved correctly through both transformations
      expect(afterFirstOp).toBe(12); // 'Say: Hello ' (was 7, moved by 5)
      expect(selections[0].startColumn).toBe(12); // Still at 'Say: Hello '
    });
  });
});
