# Comments

- Comments only for long/complex logic; not every small block.
- Execution-flow comments: short and focused on making the flow easy to follow.

**Example:**
```typescript
// get property details
const result = await getPropertyDetails(user.id, agentId, propertyId, mediaId);
// update the property media's processing status to pending
await prisma.propertyMediaProcessingDetails.update({ ... });
// add the job to the queue
await queueJob<DocumentProcessingJobPayload>(PROPERTY_DOCUMENT_PROCESSING_QUEUE, { ... });
```
