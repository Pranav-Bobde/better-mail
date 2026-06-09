# Handlers

- Handler reads like a story: validate → delete old → cleanup → create new → update → queue.
- Abstract bloating code (e.g. long resource checks) into functions with comprehensive, self-explanatory names.
- Function naming: action + condition (e.g. `updateFileIfAdmin`, `getLiveAgentIfExists`). Self-explanatory and comprehensive.
- Return shapes: `{ canProceed: boolean, error: string | null }`, `{ agent: Agent | null, found: boolean }`, etc. Helpers return data/errors; handler builds `c.json()`.
- Handle negative cases/invalid checks first with minimal 1-liner comments (not one big comment above the function).
- A function does only what its name says; choose explicit implementations.

**Example (flow):**
```typescript
// validate file type and size
const validationResult = validateMediaFileSize(file, existingMediaFileType);
if (!validationResult.valid) {
  logger.error({ validationResult, mediaId }, "Failed to validate media file size");
  return c.json({ success: false, error: validationResult.error }, 400);
}
// delete old media file from s3/minio
await deleteOldS3Media(BUCKET_NAME, oldS3Path, mediaId);
// upload new media file to s3/minio
const { url, whatsappMediaId } = await uploadNewMediaToS3(...);
```
