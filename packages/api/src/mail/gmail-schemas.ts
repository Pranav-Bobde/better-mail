import { Schema } from "effect";

// Internal Gmail REST response parsing moved from zod to effect/Schema in Phase 5.
// The oRPC wire boundary (mail/contracts.ts, sync/contracts.ts) stays on zod.
// Parsing semantics mirror the previous zod schemas exactly: `Schema.Struct`
// strips unexpected keys on decode like `z.object`, and `Schema.optional` accepts
// a missing key or an explicit `undefined` like zod `.optional()`.

const gmailHeaderSchema = Schema.Struct({
  name: Schema.String,
  value: Schema.String,
});

const gmailMessageBodySchema = Schema.Struct({
  attachmentId: Schema.optional(Schema.String),
  data: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number),
});

// Reused as the single source of truth for the shared part fields; the two
// nesting levels below extend it exactly as the previous `.extend({ parts })` did.
const gmailMessagePartBaseFields = {
  body: Schema.optional(gmailMessageBodySchema),
  filename: Schema.optional(Schema.String),
  headers: Schema.optional(Schema.Array(gmailHeaderSchema)),
  mimeType: Schema.optional(Schema.String),
  partId: Schema.optional(Schema.String),
};

const gmailMessagePartBaseSchema = Schema.Struct(gmailMessagePartBaseFields);

const nestedGmailMessagePartSchema = Schema.Struct({
  ...gmailMessagePartBaseFields,
  parts: Schema.optional(Schema.Array(gmailMessagePartBaseSchema)),
});

const gmailMessagePartSchema = Schema.Struct({
  ...gmailMessagePartBaseFields,
  parts: Schema.optional(Schema.Array(nestedGmailMessagePartSchema)),
});

export const gmailProfileResponseSchema = Schema.Struct({
  emailAddress: Schema.String,
  historyId: Schema.optional(Schema.String),
  messagesTotal: Schema.optional(Schema.Number),
  threadsTotal: Schema.optional(Schema.Number),
});

export const gmailListMessagesResponseSchema = Schema.Struct({
  messages: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        threadId: Schema.String,
      }),
    ),
  ),
  nextPageToken: Schema.optional(Schema.String),
  resultSizeEstimate: Schema.optional(Schema.Number),
});

export const gmailListThreadsResponseSchema = Schema.Struct({
  nextPageToken: Schema.optional(Schema.String),
  resultSizeEstimate: Schema.optional(Schema.Number),
  threads: Schema.optional(
    Schema.Array(
      Schema.Struct({
        historyId: Schema.optional(Schema.String),
        id: Schema.String,
        snippet: Schema.optional(Schema.String),
      }),
    ),
  ),
});

const gmailMessageResponseSchema = Schema.Struct({
  historyId: Schema.optional(Schema.String),
  id: Schema.String,
  internalDate: Schema.optional(Schema.String),
  labelIds: Schema.optional(Schema.Array(Schema.String)),
  payload: Schema.optional(gmailMessagePartSchema),
  sizeEstimate: Schema.optional(Schema.Number),
  snippet: Schema.optional(Schema.String),
  threadId: Schema.String,
});

export const gmailThreadResponseSchema = Schema.Struct({
  historyId: Schema.optional(Schema.String),
  id: Schema.String,
  // A Gmail thread always carries at least its originating message.
  messages: Schema.TupleWithRest(Schema.Tuple([gmailMessageResponseSchema]), [
    gmailMessageResponseSchema,
  ]),
});

export const gmailLabelsListResponseSchema = Schema.Struct({
  labels: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        labelListVisibility: Schema.optional(Schema.String),
        messageListVisibility: Schema.optional(Schema.String),
        name: Schema.String,
        type: Schema.String,
      }),
    ),
  ),
});

export const gmailLabelResponseSchema = Schema.Struct({
  id: Schema.String,
  labelListVisibility: Schema.optional(Schema.String),
  messageListVisibility: Schema.optional(Schema.String),
  messagesTotal: Schema.optional(Schema.Number),
  messagesUnread: Schema.optional(Schema.Number),
  name: Schema.String,
  threadsTotal: Schema.optional(Schema.Number),
  threadsUnread: Schema.optional(Schema.Number),
  type: Schema.String,
});

export const gmailSendResponseSchema = Schema.Struct({
  id: Schema.String,
  labelIds: Schema.optional(Schema.Array(Schema.String)),
  threadId: Schema.String,
});

const gmailHistoryMessageReferenceSchema = Schema.Struct({
  labelIds: Schema.optional(Schema.Array(Schema.String)),
  message: Schema.Struct({
    id: Schema.String,
    threadId: Schema.String,
  }),
});

const gmailHistoryMessageContainerSchema = Schema.Struct({
  message: Schema.Struct({
    id: Schema.String,
    threadId: Schema.String,
  }),
});

export const gmailHistoryListResponseSchema = Schema.Struct({
  history: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.String),
        labelsAdded: Schema.optional(Schema.Array(gmailHistoryMessageReferenceSchema)),
        labelsRemoved: Schema.optional(Schema.Array(gmailHistoryMessageReferenceSchema)),
        messages: Schema.optional(
          Schema.Array(
            Schema.Struct({
              id: Schema.String,
              threadId: Schema.String,
            }),
          ),
        ),
        messagesAdded: Schema.optional(Schema.Array(gmailHistoryMessageContainerSchema)),
        messagesDeleted: Schema.optional(Schema.Array(gmailHistoryMessageContainerSchema)),
      }),
    ),
  ),
  historyId: Schema.optional(Schema.String),
  nextPageToken: Schema.optional(Schema.String),
});

export const gmailWatchResponseSchema = Schema.Struct({
  expiration: Schema.String,
  historyId: Schema.String,
});

export type GmailLabel = typeof gmailLabelResponseSchema.Type;
export type GmailHistoryListResponse = typeof gmailHistoryListResponseSchema.Type;
export type GmailMessage = typeof gmailMessageResponseSchema.Type;
export type GmailMessagePart = typeof gmailMessagePartSchema.Type;
export type GmailThread = typeof gmailThreadResponseSchema.Type;
export type GmailWatchResponse = typeof gmailWatchResponseSchema.Type;
