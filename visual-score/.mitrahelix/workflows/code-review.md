---
description: Perform a thorough code review of the specified file or recent changes
---

Please perform a detailed code review following these steps:

1. Read the file(s) mentioned by the user
2. Analyze for:
   - **Bugs & Logic Errors**: Off-by-one, null/undefined, race conditions
   - **Security**: Input validation, path traversal, injection risks
   - **Performance**: Unnecessary loops, memory leaks, blocking operations
   - **Code Style**: Naming conventions, dead code, unused imports
   - **Type Safety**: Any `any` types, missing null checks, unsafe casts
3. For each issue found, explain:
   - What the problem is
   - Why it matters
   - A suggested fix
4. End with a summary of findings (critical / significant / minor counts)
