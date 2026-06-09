# Naming And Catalogs

## Rule

Use typed catalogs. No invented string codes in handlers.

## Error Catalog Naming

Official evlog pattern:

- catalog prefix: lower/dot case
- key: `UPPER_SNAKE_CASE`
- wire code: `prefix.KEY`

For agent module:

```ts
defineErrorCatalog("agent", {
  GET_AGENTS_FAILED: {
    status: 500,
    message: "Failed to fetch agents",
  },
})
```

Wire code:

```txt
agent.GET_AGENTS_FAILED
```

## Wide Event Naming

Use `operation` for searchable business operation.

Recommended:

```txt
operation = "agent.get_agents"
module = "agent"
handler = "getAgents"
```

Why:

- `agent.GET_AGENTS_FAILED` = error code/case
- `agent.get_agents` = operation/event lifecycle
- both group cleanly by module

## Typed Fields

Make one focused field type per module first, not per whole app.

For pilot:

```ts
type AgentWideEventFields = {
  operation: "agent.get_agents";
  module: "agent";
  handler: "getAgents";
  user: { id: string };
  agents: { count: number };
};
```

## Sources

- evlog catalogs: https://www.evlog.dev/learn/catalogs
- evlog typed fields: https://www.evlog.dev/learn/typed-fields
- evlog wide events: https://www.evlog.dev/learn/wide-events
