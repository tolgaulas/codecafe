# TextOperationSystem Tests

This directory contains tests for the TextOperationSystem module, which handles operational transformation for collaborative text editing.

## Test Files

1. **TextOperationTransformation.test.ts**

   - Tests the basic structure and functionality of the VersionVector and TextOperation classes
   - Verifies correct transformation behavior for simple cases

2. **TransformCursorPositionTests.test.ts**

   - Focuses specifically on cursor position transformations
   - Tests how the cursor position is adjusted based on different types of operations

3. **CursorPositionHandling.test.ts** and **RapidTypingScenarios.test.ts**
   - Additional tests that require proper mock setup for Monaco Editor
   - Currently disabled due to Monaco mocking complexity

## Common Issues and Solutions

### Cursor Position Calculation

The most significant issue fixed in the test development was ensuring consistent cursor position calculations:

1. When a user inserts text at exactly the same position as another user's cursor, the behavior depends on the lexicographical comparison of user IDs.
2. To ensure cross-platform consistency, all `localeCompare` calls in the code now use the "en" locale explicitly.
3. This guarantees that cursor position calculations behave identically on all platforms and match the backend implementation.

### Running Tests

Run all working tests:

```bash
npm test -- src/tests/__tests__/TextOperationTransformation.test.ts src/tests/__tests__/TransformCursorPositionTests.test.ts
```

Run a specific test file:

```bash
npm test -- src/tests/__tests__/TransformCursorPositionTests.test.ts
```

## Manual Testing Scenarios

For manual testing of cursor positioning, try these scenarios:

1. **User A and User B editing at the same position**

   - Have two users place cursor at the beginning of a document
   - Let User A type some text
   - Verify User B's cursor is correctly positioned after the inserted text

2. **User A typing and User B deleting text**

   - Have User A and User B open the same document
   - Let User A type several characters
   - Have User B delete a portion of the text
   - Verify both users see the correct final text and cursor positions

3. **User A and User B rapidly typing in different positions**
   - Have User A start typing at the beginning of the document
   - Concurrently have User B start typing elsewhere in the document
   - Verify both changes are properly applied and cursor positions remain correct
