---
description: Generate unit tests for the specified file or function
---

Please generate comprehensive unit tests following these steps:

1. Read the file(s) mentioned by the user
2. Identify all exported functions, classes, and methods
3. For each function/method, write tests covering:
   - **Happy path**: Normal expected inputs and outputs
   - **Edge cases**: Empty inputs, boundary values, null/undefined
   - **Error cases**: Invalid inputs, expected throws/rejections
4. Use the project's existing test framework if one is set up, otherwise use a sensible default
5. Write the test file to the appropriate location (e.g., `__tests__/` or alongside the source file)
6. Ensure all tests are runnable without additional setup
