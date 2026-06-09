# Zod Schemas Specification

## Core Principles

### 1. API Response Validation Is Mandatory
- All APIs must have response validations via Zod schemas
- Parse API responses before business logic runs

### 2. Match Schema Contract to Observed Payloads
- **Observed payloads are the source of truth** - replicate their structure exactly in the schema contract
- Don't break down schemas into base/derived patterns
- Don't abstract common fields unless truly necessary
- Each schema should be self-contained and match one specific observed payload shape

### 3. Assumption-Free Schema Contract Modeling
- Schema contract shape must come from real observed payloads/data, not hypotheticals
- Only mark fields optional when real captured payloads prove valid omission
- When omission is shape-specific, add explicit union variants instead of broad optionalization
- Any schema relaxation must ship with real fixture(s) + parse tests

### 4. Strict Zod Validation by Default
- Use strict schema validation as the default behavior for request/response parsing
- Do not accept loosely formatted values (e.g. whitespace-padded strings, numeric aliases for enum strings) unless explicitly required by product/API compatibility
- Any exception to strictness must be documented in code comments and backed by tests proving the requirement
- Any non-strict object schema (e.g. loose/pass-through/catchall) must have a nearby comment naming the real observed payload reason.

### Object Strictness Selection

- Use `z.object(...)` for API response DTOs by default: validate required output fields and strip unknown/internal fields before returning.
- Use `z.strictObject(...)` when extra keys are a contract violation and should fail parsing.
- Use `z.looseObject(...)` only for observed input payloads where extra keys are valid and must be preserved for downstream logic.
- Do not use `z.looseObject(...)` for response DTOs just to avoid errors from DB/raw objects; define the intended output DTO and let unknown fields be stripped.
- If only one nested field can be arbitrary (e.g. metadata JSON), keep the parent object as `z.object(...)` and make that field `z.unknown()`/a specific schema instead of making the whole object loose.
- DTO schemas are an output allowlist: they must prevent accidental exposure of DB/internal fields.

### 5. No Manual Runtime Type-Checking Around Zod
- Do not write manual `typeof` / null / trim / coercion ladders that replicate schema validation behavior
- Prefer direct Zod schemas (`z.enum`, `z.literal`, `z.union`, `z.nullable`, `z.optional`, `z.discriminatedUnion`) to model the contract
- Use `z.preprocess`/`z.coerce` only for explicit compatibility requirements; otherwise reject invalid shapes

### 6. Discriminated Unions
- Use `z.discriminatedUnion("discriminator_field", [...])` for robust type inference w.r.t business-logic (and such is mentioned in the task request)
- **The discriminator field must be at the root level** of the object - otherwise TypeScript inference is lost
- Only add discriminator via transform when there isn't already a suitable field for discriminated union
- If a field already exists that can discriminate, use it directly instead of adding a new one
- This enables proper TypeScript narrowing without manual type guards

### 7. Arrays: Tuple + Rest Pattern
- **Always use**: `z.tuple([schema]).rest(schema)` for arrays that must have at least one element
- **Never use**: `z.array(schema).nonempty()` or `z.array(schema).min(1)`
- The tuple pattern gives TypeScript the type `[T, ...T[]]` which guarantees the first element exists
- This enables direct access like `array[0]` without TypeScript errors
- When you know at least X elements (at start or end), prefer tuple + rest for index-safe access
- For exactly X elements, use `z.tuple([T1, T2, ...]).rest(z.never())`
- For at least X elements, use `z.tuple([T1, T2, ...]).rest(T)`
- When length is unknown (0..n), `z.array(T)` is fine

## Schema Pattern

### Standard Schema Structure

```typescript
import { z } from "zod";
import { DISCRIMINATOR_CONSTANTS } from "./constants";

export const schemaName = z.object({
  // Match observed payload structure exactly
  field1: z.string(),
  field2: z.object({
    nested: z.string(),
  }),
  arrayField: z.tuple([itemSchema]).rest(itemSchema), // Use tuple + rest for arrays
}).transform((data) => {
  // Simple transform - only add discriminator
  return {
    ...data,
    discriminator_field: DISCRIMINATOR_CONSTANTS.VALUE
  }
});
```

### Required Parse/Error Pattern

```typescript
const data = await response.json();
const parsedData = await schema.safeParseAsync(data);

if (!parsedData.success) {
  throw new Error(`API Validation Error: ${z.prettifyError(parsedData.error)}`);
}
```

- Use `z.prettifyError(parsedData.error)` in validation error messages
- Keep validation at schema/parse layer, not in handler business logic

### Example: Text Message Schema

```typescript
import { z } from "zod";
import { WHATSAPP_CALLBACK_TYPES } from "./constants";

export const whatsappTextCallbackMessageSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.tuple([z.object({
    id: z.string(),
    changes: z.tuple([z.object({
      field: z.literal("messages"),
      value: z.object({
        messaging_product: z.literal("whatsapp"),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z.tuple([contactSchema]).rest(contactSchema), // Tuple + rest
        messages: z.tuple([z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          type: z.literal("text"),
          text: z.object({
            body: z.string(),
          }),
        })]).rest(z.never()),
      })
    })]).rest(z.never()),
  })]).rest(z.never()),
}).transform((data) => {
  return {
    ...data,
    message_type: WHATSAPP_CALLBACK_TYPES.TEXT
  }
});
```

## Discriminated Union Setup

### Creating the Union

```typescript
import { z } from "zod";
import { schema1 } from "./schema1";
import { schema2 } from "./schema2";
// ... import all schemas

export const mainSchema = z.discriminatedUnion("message_type", [
  schema1,
  schema2,
  // ... all schemas
]);

export type MainSchemaType = z.infer<typeof mainSchema>;
```

## Common Patterns

### Shared Schemas
- Extract truly shared schemas to `common.ts`
- Only extract if used in multiple places
- Don't over-extract - prefer duplication over premature abstraction
- Keep schemas as inline as possible; avoid single-use fragments/helper schemas
- Keep related structures together

### Constants
- Define discriminator constants in `constants.ts`
- Use `as const` for type safety
- Import and reuse - don't duplicate

### Transform Logic
- Keep transforms at the schema level
- Only add discriminator fields
- No business logic in transforms
- Business logic belongs in separate transform files (e.g., `transformParsedCallback.ts`)

## Anti-Patterns to Avoid

### ❌ Don't Do This

```typescript
// Breaking down into base schemas
const baseSchema = z.object({ ... });
const derivedSchema = baseSchema.extend({ ... });

// Adding validation
z.array(schema).nonempty()
z.array(schema).min(1)
schema.refine(...)

// Non-null assertions
data.field[0]!

// Complex transforms
.transform((data) => {
  // Complex validation logic
  if (!data.field) throw new Error(...);
  // Business logic
  return processData(data);
})
```

### ✅ Do This Instead

```typescript
// Self-contained schema matching observed payload exactly
const schema = z.object({
  // Full structure here
  arrayField: z.tuple([itemSchema]).rest(itemSchema),
}).transform((data) => {
  // Simple - just add discriminator
  return { ...data, message_type: CONSTANT };
});
```

## When to Use Each Pattern

### Use Tuple + Rest When
- Array must have at least one element
- You need to access `array[0]` without TypeScript errors
- The observed payload always has at least one item

### Use Regular Array When
- Array can be empty
- No need to access first element directly

### Use Discriminated Union When
- You have multiple similar schemas that differ in one field
- You want TypeScript to narrow types based on that field
- You have clear observed payload samples for each type
- **The discriminator field must be at the root level** - nested fields won't work for type narrowing

### When to Add Discriminator vs Use Existing Field
- **Use existing field**: If the observed payload already has a root-level field that can discriminate (e.g., `type: "text"` vs `type: "audio"`), use it directly
- **Add via transform**: Only when no suitable root-level discriminator exists in the observed payload structure

## Summary

1. **Validate all API responses** - parse with Zod before business logic
2. **Use strict schemas by default** - reject non-contract payloads unless explicit compatibility requires otherwise
3. **Avoid manual type-checking/coercion layers** - model contracts directly in Zod
4. **Match schema contracts to observed payloads** - observed payloads are the source of truth
5. **Model schema contracts assumption-free** - optional fields only when real payloads prove omission
6. **Use tuple + rest for constrained arrays** - enables safe indexed access like `array[0]`
7. **Use discriminated unions** - keep discriminator at root for type narrowing
8. **Keep transforms simple** - only add discriminators
9. **Keep schemas self-contained and local** - avoid premature abstraction
10. **Keep it simple** - avoid over-engineering
