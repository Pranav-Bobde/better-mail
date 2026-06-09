# DB modules

- DB layer tightly coupled with Prisma: use Prisma types for function parameters when the caller passes Prisma-shaped args/data that are not inferred at the call site, e.g. `Prisma.LeadCreateInput`, `Prisma.LeadUpdateInput`, `Prisma.LeadUpsertArgs`.
- Keep narrow DB functions narrow. If a function name encodes a specific lookup/filter, expose only the exact primitive params needed for that operation, e.g. `findLeadByIdAndAgentId(leadId: string, agentId: string)`, not `Prisma.LeadWhereInput`.
- Do not widen function params just to use Prisma types. Wide Prisma inputs make task-specific DB functions meaningless and allow unsupported filters.
- Function names: action + entity + filter (e.g. `getAgentById(id)`, `getAgentByCurrentUser(id, user_id)`).
- DB reads must enforce active owner scope by default; only skip scope for data that is intentionally shared across all owners, and make that exception obvious in the function name or nearby comment.
