# TypeScript

- Prefer `type` over `interface`.
- Never specify explicit return types on functions; rely on TS inference.
- Do not use manual `as SomeType` assertions or refine types manually (e.g. `sampleQaJson?: Array<{ question: string; answer: string }>`).
- `as const` is allowed and encouraged for literal narrowing/discriminants (e.g. `success: true as const`).
- Assumption-free typing:
  - Parsed/transformed TypeScript types must stay aligned with schema guarantees.
  - Do not loosen fields to optional "just in case"; loosen only when real payload evidence + schema support exist.
  - Do not add defensive null/undefined guards for fields guaranteed by schema on that parsed path.
  - Prefer explicit union variants over catch-all optional fields when modeling observed shape differences.
- Prefer `z.discriminatedUnion("<key>", [...])` over plain `z.union([...])` whenever members share a discriminator key (for free: better narrowing, clearer errors, and simpler branching).
- Always use `satisfies` instead of typing variables directly. Let TS infer the variable type while `satisfies` validates the shape.
- When handling all cases of a union/enum, always use an exhaustive `switch` with a `never` default to catch unhandled cases at compile time.
- Tight coupling between zod schema/db schema definitions; single source of truth so one file change updates the codebase.
- Do not create custom types that break type-safety with library types; derive from library exported types.
- Prisma is SSOT(Single Source Of Truth) for DB domain types/enums. Prefer generated Prisma types/enums (`Prisma.*`, `Model*`, `*Enum`) over hardcoded strings/manual DB shape types.
- When literal narrowing is needed (e.g. `z.literal(...)`), derive literals from Prisma enums via constants, not raw strings.
- Helper functions must never receive the Hono context. Helpers return data/error; handlers build `c.json()`.
- Name helper functions/variables by the exact value they return/extract. Avoid vague or alien names like `container`, `record`, `handlerData` when the code is really getting something specific like `lastAiMessage`, `agentConfig`, or `flowPrivateKey`.

**Example (satisfies over typing):**
```typescript
// Good — inferred type, validated shape
const config = {
  retries: 3,
  timeout: 5000,
} satisfies RetryConfig;

// Bad — loses literal types
const config: RetryConfig = {
  retries: 3,
  timeout: 5000,
};
```

**Example (`as const` for discriminants):**
```typescript
const result = {
  success: true as const,
  action: "INIT" as const,
} satisfies { success: true; action: "INIT" };
```

**Example (exhaustive switch):**
```typescript
const getStatusLabel = (status: LeadStatus) => {
  switch (status) {
    case "VERIFIED": return "Verified";
    case "UN_VERIFIED": return "Unverified";
    default: return status satisfies never;
  }
};
```

**Example (library types):**
```typescript
// Use
import { type Queue } from "pg-boss";
// Use it as Omit<Queue, "name"> as inferred from createQueue
```

**Example (discriminated union + Prisma enum literal constants):**
```typescript
import { PropertyMediaTypeEnum } from "../../db/prisma/generated/enums";
import { z } from "zod";

const PROPERTY_IMAGE_TYPE = PropertyMediaTypeEnum.PROPERTY_IMAGE;
const PROPERTY_DOCUMENT_TYPE = PropertyMediaTypeEnum.PROPERTY_DOCUMENT;

const uploadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(PROPERTY_IMAGE_TYPE), name: z.string() }),
  z.object({ type: z.literal(PROPERTY_DOCUMENT_TYPE), name: z.string(), description: z.string() }),
]);
```

**Example (specific helper naming):**
```typescript
// Good
const lastAiMessage = getLastAiMessageFromAgentResult(result);

// Bad
const responseContainer = getResponseContainer(result);
```

**Example:**
```typescript
async function getAgentIfExists(agentId: string, userId: string) {
  const agent = await findAgentById(agentId, userId);
  if (!agent) return { agent: null, found: false as const };
  return { agent, found: true as const };
}
// Handler uses getAgentIfExists(id, user.id) then c.json(...)
```
