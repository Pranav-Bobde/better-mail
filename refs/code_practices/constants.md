# Constants

- Module-level constants for env-derived or computed values (top of file), not inline multiple times.
- Global names (e.g. queue names) exported in one place for use across related files.

**Example:**
```typescript
const BUCKET_NAME = env.BUCKET_NAME;
const BUCKET_BASE_URL = `http://localhost:${env.MINIO_API_PORT}/${BUCKET_NAME}/`;
const PROPERTY_DOCUMENT_PROCESSING_QUEUE = "property-document-processing-queue";
```
