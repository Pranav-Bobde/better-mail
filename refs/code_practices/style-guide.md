# Style Guide

## Code Flow

Desc

- Write code in execution order, it should read like a story: validate -> fetch -> cleanup -> create -> update -> queue.
- Handle invalid/negative cases first.
- Validate required runtime fields once at the boundary, then pass narrowed values downstream.
- Keep the happy path flat. Prefer guard clauses and early returns over nested `if/else` branches.
- Target at most 2 levels of nesting in normal handler code. If logic reaches 3 levels, flatten with a guard clause or extract a named helper.
- Do not keep an `else` branch after a branch already returned or threw.
- For enum/union branching, prefer an exhaustive `switch` with a `never`/`satisfies never` default.

Example

```typescript
const validationResult = validateMediaFileSize(file, existingMediaFileType);
if (!validationResult.valid) {
  logger.error({ validationResult, mediaId }, "Failed to validate media file size");
  return { success: false, error: validationResult.error };
}

await deleteOldS3Media(BUCKET_NAME, oldS3Path, mediaId);
const { url, whatsappMediaId } = await uploadNewMediaToS3(...);
await prisma.propertyMedia.update({ where: { id: mediaId }, data: { url, whatsappMediaId } });
```

Example

```typescript
function getWebhookAction(status: AgentStatusEnum) {
  switch (status) {
    case AgentStatusEnum.LIVE:
      return "set";
    case AgentStatusEnum.OFFLINE:
      return "clear";
    default:
      return status satisfies never;
  }
}
```

## Abstraction

Desc

- Abstract bloated logic into self-explanatory helpers.
- A function should only do what its name says.
- Prefer explicit implementations over clever or overloaded ones.
- Extract nested branches when the helper name explains a real step in the flow.
- Avoid extracting tiny wrappers that hide one obvious statement without reducing branching or duplication.

Example

```typescript
const validationResult = validateMediaFileSize(file, existingMediaFileType);
if (!validationResult.valid) {
  logger.error({ validationResult, mediaId }, "Failed to validate media file size");
  return { success: false, error: validationResult.error };
}
```

## Multi-Use-Case Files

Desc

- When working with a file that handles multiple distinct use cases, bifurcate the file by use case.
- Repeat that split across the file's main groups when practical: constants, helpers, schemas, types, parsers.

Example

```typescript
// Constants
// Book Visit
const bookVisitTimeSlots = ["morning", "afternoon", "evening"] as const;

// EMI Calculator
const emiLoanAmountPattern = /.../;

// Schemas
// Book Visit
const bookVisitFlowResponseSchema = z.object({ ... });

// EMI Calculator
const calculateEmiFlowResponseSchema = z.object({ ... });
```

## Naming Conventions

Desc

- Use names that explain action + condition.
- Prefer comprehensive names over short ambiguous ones.

Example

```typescript
updateFileIfAdmin();
getLiveAgentIfExists();
```

## Return Shapes

Desc

- Return structured objects instead of loose booleans or mixed values.
- Helpers should return data/errors; callers should build responses.
- Boundary validation helpers should return a narrowed context plus early-return response.

Example

```typescript
function getRoutingContextOrDrop(
  from: string | undefined,
  phoneNumberId: string | undefined,
  c: Context,
): { context: RoutingContext | null; response: Response | null } {
  if (!from) return { context: null, response: c.json({ success: true, message: "No sender" }) };
  if (!phoneNumberId) return { context: null, response: c.json({ success: true, message: "No phoneNumberId" }) };
  return { context: { from, phoneNumberId }, response: null };
}
```
