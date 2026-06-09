# Tests

## Overview

Test what actually happens in production. Never use mock data based on assumptions. Every piece of test data should be the real output of a dependency function.

## Test pyramid

- **Unit** — Many, fast; tests individual functions.
- **Integration** — Medium quantity; validates function chains.
- **E2E** — Few, expensive; high confidence.

### Golden rule

For `f(g(x))`: test g(x) first → get real output Y → use real Y to test f(Y). Never hardcode mock data for f() without first running g() to get real output.

### Execution flow mapping

1. Map the execution flow — what functions, in what order.
2. Identify dependencies — which output feeds into the next.
3. Execute in order — run upstream functions first to get real outputs.

## Test type guidelines

- **Unit**: Test individual functions; for dependencies, execute dependency first, use that output as input.
- **Integration**: Test function chains; execute full chain with real intermediate outputs.
- **E2E**: Complete workflows; sandboxed environments; never production data.

## Data safety

- **DB operations** — risky; get user approval (test DB, mock layer, or safety guards).
- **File system** — risky; get user approval; use sandbox (e.g. /tmp/test-sandbox/).
- **Sandbox**: Isolated dirs; clean up after tests; document sandbox in setup.

## Discussion protocol

Ask the user before writing any test that involves: DB, file system modifications, external APIs, production data, destructive operations. Present: scenario, functions involved, potential impact, proposed approach. Wait for explicit approval.

## Approval checklist

- Database operations → User approval required
- File system modifications → User approval required
- External API calls → User approval required
- Deletion of any data → User approval required
- Modifying production directories → User approval required
- User has explicitly approved the approach

## Anti-patterns

- Assumed data structures (verify, do not assume).
- Hardcoded paths (use sandbox / OUTPUT_BASE_DIR).
- Skipping steps (test upstream first).
- Partial execution (run full chain; do not test in isolation without real inputs).
- Production data usage (never; use sandbox).

## Execution workflow

1. **Setup**: Identify functions and risks; get approval; create sandbox; write real data.
2. **Execute**: Call function under test; real paths and data; dependency order.
3. **Verify**: Check outputs exist; validate against real expected values.
4. **Cleanup**: Remove test dirs; reset state; document side effects.

## One exception

Use explicit mock data only when: function is purely mathematical (e.g. add(a, b)); no file/network/external deps; mock is trivial and cannot fail in production. For files, paths, APIs, or user input → always use real execution.

## Caution: Global module mocks (Bun)

- **`mock.module()` is process-global.** Any file that mocks a shared module (e.g. `utils/prisma`) replaces it for the whole process. Every other test file that imports that module in the same run gets the mock, not the real implementation — which can break integration tests or tests that expect the real module.
