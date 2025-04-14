import {
  TextOperation,
  Client,
  OTSelection,
  IClientCallbacks,
} from "../../ot/TextOperationSystem";

// Helper to compare TextOperations (relies on your TextOperation having a similar structure/equality check)
// For Jest/Vitest, `toEqual` often performs deep equality checks.
const expectOpsEqual = (
  actual: TextOperation,
  expected: TextOperation,
  message: string
) => {
  expect(actual.ops).toEqual(expected.ops);
  expect(actual.baseLength).toEqual(expected.baseLength);
  expect(actual.targetLength).toEqual(expected.targetLength);
  // Or simply: expect(actual).toEqual(expected); if deep equality works
};

describe("TextOperation", () => {
  // --- Apply Tests ---
  test("Apply: Basic Insert", () => {
    const op = new TextOperation().insert("Hello");
    const result = op.apply("");
    expect(result).toEqual("Hello");
  });

  test("Apply: Basic Retain and Insert", () => {
    const op = new TextOperation().retain(5).insert(" World");
    const result = op.apply("Hello");
    expect(result).toEqual("Hello World");
  });

  test("Apply: Basic Delete", () => {
    const op = new TextOperation().retain(5).delete(6); // Delete " World"
    // Note: The TS implementation doesn't have the initial baseLength check
    // const initialDoc = "Hello World";
    // op.baseLength = initialDoc.length; // Manually set baseLength if needed for testing stricter apply
    const result = op.apply("Hello World");
    expect(result).toEqual("Hello");
  });

  test("Apply: Insert, Retain, Delete", () => {
    // Base: "Hello" (len 5)
    // Op: insert("Start "), retain(2), delete(1), retain(2)
    const op = new TextOperation()
      .insert("Start ")
      .retain(2)
      .delete(1)
      .retain(2);
    const result = op.apply("Hello");
    expect(result).toEqual("Start Helo");
  });

  // TODO: Add apply tests for error conditions (past end, etc.) if needed,
  // keeping in mind the TS implementation might not throw the same errors as Java/ot.js reference apply.

  // --- Invert Tests ---
  test("Invert: Insert", () => {
    const op = new TextOperation().insert("Test");
    const expected = new TextOperation().delete(4);
    const actual = op.invert(""); // Base doc "" needed for insert
    expectOpsEqual(actual, expected, "Invert insert should be delete");
  });

  test("Invert: Delete", () => {
    const op = new TextOperation().retain(2).delete(3).retain(1); // Delete "llo" from "Hello"
    const expected = new TextOperation().retain(2).insert("llo").retain(1);
    const actual = op.invert("Hello"); // Base doc "Hello" needed for delete
    expectOpsEqual(actual, expected, "Invert delete should be insert");
  });

  test("Invert: Retain", () => {
    const op = new TextOperation().retain(5);
    const expected = new TextOperation().retain(5);
    const actual = op.invert("Hello");
    expectOpsEqual(actual, expected, "Invert retain should be retain");
  });

  test("Invert: Mixed", () => {
    const op = new TextOperation().retain(2).insert("XXX").delete(2).retain(1); // "Hello" -> "HeXXXo"
    const expected = new TextOperation()
      .retain(2)
      .delete(3)
      .insert("ll")
      .retain(1);
    const actual = op.invert("Hello");
    expectOpsEqual(actual, expected, "Invert mixed op failed");
  });

  // --- Compose Tests ---
  test("Compose: Insert then Insert", () => {
    const op1 = new TextOperation().insert("A"); // "" -> "A"
    const op2 = new TextOperation().retain(1).insert("B"); // "A" -> "AB"
    const expected = new TextOperation().insert("AB"); // "" -> "AB"
    const actual = op1.compose(op2);
    expectOpsEqual(actual, expected, "Compose Insert/Insert failed");
  });

  test("Compose: Delete then Delete", () => {
    const op1 = new TextOperation().retain(1).delete(2).retain(2); // "Hello" -> "Hlo"
    const op2 = new TextOperation().retain(1).delete(1).retain(1); // "Hlo" -> "Ho"
    const expected = new TextOperation().retain(1).delete(3).retain(1); // "Hello" -> "Ho"
    const actual = op1.compose(op2);
    expectOpsEqual(actual, expected, "Compose Delete/Delete failed");
  });

  test("Compose: Insert then Delete", () => {
    const op1 = new TextOperation().retain(2).insert("XXX").retain(3); // "Hello" -> "HeXXXllo"
    const op2 = new TextOperation().retain(4).delete(2).retain(2); // "HeXXXllo" -> "HeXXlo" (delete Xl)
    const expected = new TextOperation()
      .retain(2)
      .insert("XX")
      .delete(1)
      .retain(2); // "Hello" -> "HeXXlo"
    const actual = op1.compose(op2);
    expectOpsEqual(actual, expected, "Compose Insert/Delete failed");
  });

  test("Compose: Delete then Insert", () => {
    const op1 = new TextOperation().retain(1).delete(2).retain(2); // "Hello" -> "Hlo"
    const op2 = new TextOperation().retain(1).insert("EY").retain(2); // "Hlo" -> "HEYlo"
    const expected = new TextOperation()
      .retain(1)
      .delete(2)
      .insert("EY")
      .retain(2); // "Hello" -> "HEYlo"
    const actual = op1.compose(op2);
    expectOpsEqual(actual, expected, "Compose Delete/Insert failed");
  });

  test("Compose: Throws on length mismatch", () => {
    const op1 = new TextOperation().insert("A"); // target 1
    const op2 = new TextOperation().retain(2); // base 2
    expect(() => {
      op1.compose(op2);
    }).toThrow(/The base length.*second operation/);
  });

  // --- Transform Tests ---
  test("Transform: Identity", () => {
    const op1 = new TextOperation().insert("abc").retain(5).delete(2); // base 7, target 8
    const op2 = new TextOperation().retain(op1.baseLength); // base 7, target 7

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);

    const expectedOp2Prime = new TextOperation().retain(op1.targetLength); // Should retain 8

    expectOpsEqual(op1Prime, op1, "Op1' should equal Op1");
    expectOpsEqual(
      op2Prime,
      expectedOp2Prime,
      "Op2' should be retain(op1.targetLength)"
    );
  });

  test("Transform: Concurrent Inserts at Different Positions", () => {
    const op1 = new TextOperation().retain(5).insert(" Beautiful ").retain(5); // Base 10
    const op2 = new TextOperation().insert("Hi ").retain(10); // Base 10

    const expectedOp1Prime = new TextOperation()
      .retain(3)
      .retain(5)
      .insert(" Beautiful ")
      .retain(5);
    const expectedOp2Prime = new TextOperation()
      .insert("Hi ")
      .retain(5)
      .retain(11)
      .retain(5);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
    expectOpsEqual(op1Prime, expectedOp1Prime, "Op1' transformed incorrectly");
    expectOpsEqual(op2Prime, expectedOp2Prime, "Op2' transformed incorrectly");
  });

  test("Transform: Concurrent Inserts at Same Position", () => {
    const op1 = new TextOperation().retain(5).insert("A").retain(5); // Base 10
    const op2 = new TextOperation().retain(5).insert("B").retain(5); // Base 10

    const expectedOp1Prime = new TextOperation()
      .retain(5)
      .insert("A")
      .retain(1)
      .retain(5);
    const expectedOp2Prime = new TextOperation()
      .retain(5)
      .retain(1)
      .insert("B")
      .retain(5);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
    expectOpsEqual(op1Prime, expectedOp1Prime, "Op1' transformed incorrectly");
    expectOpsEqual(op2Prime, expectedOp2Prime, "Op2' transformed incorrectly");
  });

  test("Transform: Delete vs Insert", () => {
    const op1 = new TextOperation().retain(2).delete(3).retain(5); // Base 10
    const op2 = new TextOperation().retain(5).insert("XXX").retain(5); // Base 10

    const expectedOp1Prime = new TextOperation().retain(2).delete(3).retain(8);
    const expectedOp2Prime = new TextOperation()
      .retain(2)
      .insert("XXX")
      .retain(5);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
    expectOpsEqual(
      op1Prime,
      expectedOp1Prime,
      "Op1' (delete) transformed incorrectly"
    );
    expectOpsEqual(
      op2Prime,
      expectedOp2Prime,
      "Op2' (insert) transformed incorrectly"
    );
  });

  test("Transform: Insert vs Delete", () => {
    const op1 = new TextOperation().retain(5).insert("XXX").retain(5); // Base 10
    const op2 = new TextOperation().retain(2).delete(3).retain(5); // Base 10

    const expectedOp1Prime = new TextOperation()
      .retain(2)
      .insert("XXX")
      .retain(5);
    const expectedOp2Prime = new TextOperation().retain(2).delete(3).retain(8);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
    expectOpsEqual(
      op1Prime,
      expectedOp1Prime,
      "Op1' (insert) transformed incorrectly"
    );
    expectOpsEqual(
      op2Prime,
      expectedOp2Prime,
      "Op2' (delete) transformed incorrectly"
    );
  });

  test("Transform: Concurrent Deletes Overlapping", () => {
    const op1 = new TextOperation().retain(1).delete(4).retain(5); // Base 10
    const op2 = new TextOperation().retain(3).delete(4).retain(3); // Base 10

    const expectedOp1Prime = new TextOperation().retain(1).delete(2).retain(3);
    const expectedOp2Prime = new TextOperation().retain(1).delete(2).retain(3);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
    expectOpsEqual(op1Prime, expectedOp1Prime, "Op1' transformed incorrectly");
    expectOpsEqual(op2Prime, expectedOp2Prime, "Op2' transformed incorrectly");
  });

  test("Transform: Throws exception for mismatched base lengths", () => {
    const op1 = new TextOperation().retain(10); // baseLength 10
    const op2 = new TextOperation().retain(11); // baseLength 11

    // The TS code *does* have the baseLength check from ot.js
    expect(() => {
      TextOperation.transform(op1, op2);
    }).toThrow(/Cannot transform operations: first operation is too short/);
  });

  test("Transform: Insert at start vs Delete spanning start", () => {
    const op1 = new TextOperation().insert("XXX").retain(5); // Base 5
    const op2 = new TextOperation().delete(2).retain(3); // Base 5

    const expectedOp1Prime = new TextOperation().insert("XXX").retain(3);
    const expectedOp2Prime = new TextOperation().retain(3).delete(2).retain(3);

    const [op1Prime, op2Prime] = TextOperation.transform(op1, op2);
    expectOpsEqual(
      op1Prime,
      expectedOp1Prime,
      "Op1' (insert) transformed incorrectly"
    );
    expectOpsEqual(
      op2Prime,
      expectedOp2Prime,
      "Op2' (delete) transformed incorrectly"
    );
  });
});

describe("Client State Machine", () => {
  let client: Client;
  let revision: number;
  let mockCallbacks: jest.Mocked<IClientCallbacks>; // Use jest.Mocked for type safety

  beforeEach(() => {
    revision = 5; // Example starting revision
    // Create mock functions for callbacks
    mockCallbacks = {
      sendOperation: jest.fn(),
      applyOperation: jest.fn(),
      sendSelection: jest.fn(),
      getSelection: jest.fn(() => OTSelection.createCursor(0)), // Example selection
      setSelection: jest.fn(),
    };
    client = new Client(revision, "user-test-id", mockCallbacks);
  });

  test("Initial state is Synchronized", () => {
    expect(client.state.constructor.name).toBe("Synchronized");
  });

  test("Synchronized: applyClient sends op and changes state to AwaitingConfirm", () => {
    const op = new TextOperation().insert("A");
    client.applyClient(op);

    expect(client.state.constructor.name).toBe("AwaitingConfirm");
    expect((client.state as any).outstanding).toBe(op); // Check outstanding op
    expect(mockCallbacks.sendOperation).toHaveBeenCalledTimes(1);
    expect(mockCallbacks.sendOperation).toHaveBeenCalledWith(revision, op);
  });

  test("Synchronized: applyServer applies op and stays Synchronized", () => {
    const op = new TextOperation().insert("B");
    client.applyServer(op);

    expect(client.state.constructor.name).toBe("Synchronized");
    expect(mockCallbacks.applyOperation).toHaveBeenCalledTimes(1);
    expect(mockCallbacks.applyOperation).toHaveBeenCalledWith(op);
    expect(client.revision).toBe(revision + 1); // Revision increments
  });

  test("AwaitingConfirm: applyClient buffers op and changes state to AwaitingWithBuffer", () => {
    const op1 = new TextOperation().insert("A"); // Outstanding
    const op2 = new TextOperation().retain(1).insert("B"); // Buffered

    client.applyClient(op1); // Go to AwaitingConfirm
    expect(client.state.constructor.name).toBe("AwaitingConfirm");

    client.applyClient(op2); // Apply second op

    expect(client.state.constructor.name).toBe("AwaitingWithBuffer");
    expect((client.state as any).outstanding).toBe(op1);
    // Check buffer is op2 (or composed if applicable, but not here)
    expectOpsEqual((client.state as any).buffer, op2, "Buffer op incorrect");
    expect(mockCallbacks.sendOperation).toHaveBeenCalledTimes(1); // Only first op sent
  });

  test("AwaitingConfirm: applyServer transforms outstanding/server op, applies, stays AwaitingConfirm", () => {
    const opOutstanding = new TextOperation().retain(5).insert("A"); // Base 5, Target 6
    const opServer = new TextOperation().insert("Hi").retain(5); // Base 5, Target 7

    client.applyClient(opOutstanding); // State: AwaitingConfirm
    const initialOutstanding = (client.state as any).outstanding;
    expect(initialOutstanding).toBe(opOutstanding);

    client.applyServer(opServer);

    // apply(S, opOutstanding) = "Base A"
    // apply(S, opServer) = "HiBase"

    // transform(opOutstanding, opServer)
    // opOutstanding': retain(2).retain(5).insert("A") => Retain "Hi", Retain "Base", Insert "A"
    // opServer': insert("Hi").retain(5).retain(1) => Insert "Hi", Retain "Base", Retain "A"

    const expectedNewOutstanding = new TextOperation()
      .retain(2)
      .retain(5)
      .insert("A");
    const expectedAppliedOp = new TextOperation()
      .insert("Hi")
      .retain(5)
      .retain(1);

    expect(client.state.constructor.name).toBe("AwaitingConfirm");
    expectOpsEqual(
      (client.state as any).outstanding,
      expectedNewOutstanding,
      "Outstanding op not transformed correctly"
    );
    expect(mockCallbacks.applyOperation).toHaveBeenCalledTimes(1);
    expectOpsEqual(
      mockCallbacks.applyOperation.mock.calls[0][0],
      expectedAppliedOp,
      "Server op not transformed/applied correctly"
    );
    expect(client.revision).toBe(revision + 1);
  });

  test("AwaitingConfirm: serverAck changes state to Synchronized", () => {
    const op1 = new TextOperation().insert("A");
    client.applyClient(op1); // State: AwaitingConfirm
    client.serverAck();

    expect(client.state.constructor.name).toBe("Synchronized");
    expect(client.revision).toBe(revision + 1);
  });

  // TODO: Add tests for AwaitingWithBuffer state transitions (applyClient, applyServer, serverAck)
  // These are more complex due to the buffer composition and double transforms.

  test("transformSelection transforms based on state", () => {
    const selection = OTSelection.createCursor(10);
    const opOutstanding = new TextOperation().insert("Start").retain(20); // base 20, target 25
    const opBuffer = new TextOperation().retain(25).insert("End"); // base 25, target 28

    // Synchronized
    expect(client.transformSelection(selection).ranges[0].head).toBe(10);

    // AwaitingConfirm
    client.applyClient(opOutstanding);
    expect(client.state.constructor.name).toBe("AwaitingConfirm");
    // selection should be shifted by opOutstanding insert
    expect(client.transformSelection(selection).ranges[0].head).toBe(10 + 5); // 15

    // AwaitingWithBuffer
    client.applyClient(opBuffer);
    expect(client.state.constructor.name).toBe("AwaitingWithBuffer");
    // selection should be shifted by opOutstanding AND opBuffer
    expect(client.transformSelection(selection).ranges[0].head).toBe(10 + 5); // Buffer insert is after selection
  });
});
