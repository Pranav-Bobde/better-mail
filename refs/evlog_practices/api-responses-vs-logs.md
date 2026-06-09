# API Responses Vs Logs

## Rule

API response = safe user/client contract.

Logs = operator/dev truth, with redaction.

## API Response Can Include

- stable `code`
- safe `message`
- safe `fix` only when caller can act
- request/support id later if needed

Example:

```json
{
  "success": false,
  "error": {
    "code": "agent.GET_AGENTS_FAILED",
    "message": "Failed to fetch agents",
    "fix": "Refresh and try again"
  }
}
```

## Logs Can Include

- `why`
- backend fix/runbook hint
- original `cause`
- stack
- DB/service/provider error class
- safe IDs: `request_id`, `user.id`, `agentId`, `leadId`, `whatsappMessageId`
- `internal` context from evlog structured error

Example:

```json
{
  "operation": "agent.get_agents",
  "error": {
    "code": "agent.GET_AGENTS_FAILED",
    "message": "Failed to fetch agents",
    "why": "findAgents threw while reading agents for user",
    "fix": "Check DB connectivity and Prisma error code",
    "internal": {
      "handler": "getAgents",
      "dbFunction": "findAgents"
    }
  }
}
```

## Never In API Response

- raw stack
- DB URL
- SQL params with sensitive data
- auth headers/cookies
- tokens/API keys
- raw provider payloads
- env values
- raw phone numbers

## Never In Logs

- secrets
- tokens/API keys
- auth headers/cookies
- DB URLs
- raw phone numbers
- full request body by default

## Decision

Use evlog `internal` for backend-only context. `internal` can land in wide event logs. It must not be exposed to client JSON.

## Sources

- evlog structured errors: https://www.evlog.dev/learn/structured-errors
- evlog best practices: https://www.evlog.dev/reference/best-practices
- Logging Sucks: https://loggingsucks.com/
