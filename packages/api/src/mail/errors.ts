import { defineErrorCatalog } from "evlog";

export const mailErrors = defineErrorCatalog("mail", {
  AUTH_REQUIRED: {
    status: 200,
    message: "Sign in required",
    why: "A user session is required before accessing Gmail for this request",
    fix: "Sign in with Google and retry the mailbox request",
    internal: {
      dependency: "better-auth",
      dependencyOperation: "getSession",
      module: "mail",
    },
  },
  GMAIL_ACCOUNT_NOT_CONNECTED: {
    status: 200,
    message: "Gmail account not connected",
    why: "The signed-in user does not have a connected Google account access token",
    fix: "Reconnect the Google account with the Gmail access (gmail.modify) scope",
    internal: {
      dependency: "better-auth",
      dependencyOperation: "getAccessToken",
      module: "mail",
    },
  },
  GMAIL_ACCESS_TOKEN_REQUEST_FAILED: {
    status: 200,
    message: "Gmail auth failed",
    why: "Better Auth failed while loading or refreshing the user's Google access token",
    fix: "Check Google OAuth account connection, token expiry, and granted Gmail scopes",
    internal: {
      dependency: "better-auth",
      dependencyOperation: "getAccessToken",
      module: "mail",
    },
  },
  GMAIL_SCOPE_MISSING: {
    status: 200,
    message: "Gmail scope missing",
    why: "The connected Google account did not grant a required Gmail API scope",
    fix: "Reconnect Google and approve the requested Gmail access (gmail.modify) scope",
    internal: {
      dependency: "better-auth",
      dependencyOperation: "getAccessToken",
      module: "mail",
    },
  },
  GMAIL_GET_LABEL_FAILED: {
    status: 200,
    message: "Gmail label read failed",
    why: "Gmail labels.get failed while reading mailbox counts",
    fix: "Check Gmail label id, response status, and mailbox API access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "labels.get",
      module: "mail",
    },
  },
  GMAIL_GET_LABEL_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail label response invalid",
    why: "Gmail labels.get returned a response that did not match the expected label contract",
    fix: "Check Gmail label response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "labels.get",
      module: "mail",
    },
  },
  GMAIL_GET_MESSAGE_FAILED: {
    status: 200,
    message: "Gmail message read failed",
    why: "Gmail messages.get failed while loading mailbox messages",
    fix: "Check Gmail message id, response status, and mailbox API access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "messages.get",
      module: "mail",
    },
  },
  GMAIL_GET_MESSAGE_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail message response invalid",
    why: "Gmail messages.get returned a response that did not match the expected message contract",
    fix: "Check Gmail message response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "messages.get",
      module: "mail",
    },
  },
  GMAIL_GET_PROFILE_FAILED: {
    status: 200,
    message: "Gmail profile read failed",
    why: "Gmail users.getProfile failed while loading mailbox identity",
    fix: "Check Gmail profile response status and OAuth mailbox access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.getProfile",
      module: "mail",
    },
  },
  GMAIL_GET_PROFILE_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail profile response invalid",
    why: "Gmail users.getProfile returned a response that did not match the expected profile contract",
    fix: "Check Gmail profile response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.getProfile",
      module: "mail",
    },
  },
  GMAIL_GET_THREAD_FAILED: {
    status: 200,
    message: "Gmail thread read failed",
    why: "Gmail threads.get failed while loading a conversation thread",
    fix: "Check Gmail thread id, response status, and mailbox API access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "threads.get",
      module: "mail",
    },
  },
  GMAIL_GET_THREAD_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail thread response invalid",
    why: "Gmail threads.get returned a response that did not match the expected thread contract",
    fix: "Check Gmail thread response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "threads.get",
      module: "mail",
    },
  },
  GMAIL_LIST_LABELS_FAILED: {
    status: 200,
    message: "Gmail labels read failed",
    why: "Gmail labels.list failed while loading label metadata for mailbox messages",
    fix: "Check Gmail labels response status and OAuth mailbox access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "labels.list",
      module: "mail",
    },
  },
  GMAIL_LIST_LABELS_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail labels response invalid",
    why: "Gmail labels.list returned a response that did not match the expected labels contract",
    fix: "Check Gmail labels response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "labels.list",
      module: "mail",
    },
  },
  GMAIL_LIST_MESSAGES_FAILED: {
    status: 200,
    message: "Gmail message list failed",
    why: "Gmail messages.list failed while loading mailbox messages",
    fix: "Check Gmail query, response status, and OAuth mailbox access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "messages.list",
      module: "mail",
    },
  },
  GMAIL_LIST_MESSAGES_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail message list response invalid",
    why: "Gmail messages.list returned a response that did not match the expected list contract",
    fix: "Check Gmail messages.list response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "messages.list",
      module: "mail",
    },
  },
  GMAIL_LIST_THREADS_FAILED: {
    status: 200,
    message: "Gmail thread list failed",
    why: "Gmail threads.list failed while loading mailbox threads",
    fix: "Check Gmail query, response status, and OAuth mailbox access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "threads.list",
      module: "mail",
    },
  },
  GMAIL_LIST_THREADS_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail thread list response invalid",
    why: "Gmail threads.list returned a response that did not match the expected list contract",
    fix: "Check Gmail threads.list response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "threads.list",
      module: "mail",
    },
  },
  GMAIL_CREATE_DRAFT_FAILED: {
    status: 200,
    message: "Gmail draft create failed",
    why: "Gmail drafts.create failed while saving a new draft message",
    fix: "Check draft MIME payload, response status, and Gmail access (gmail.modify) scope",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.create",
      module: "mail",
    },
  },
  GMAIL_CREATE_DRAFT_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail draft create response invalid",
    why: "Gmail drafts.create returned a response that did not match the expected draft contract",
    fix: "Check Gmail drafts.create response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.create",
      module: "mail",
    },
  },
  GMAIL_UPDATE_DRAFT_FAILED: {
    status: 200,
    message: "Gmail draft update failed",
    why: "Gmail drafts.update failed while replacing an existing draft message",
    fix: "Check draft id, draft MIME payload, response status, and Gmail access (gmail.modify) scope",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.update",
      module: "mail",
    },
  },
  GMAIL_UPDATE_DRAFT_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail draft update response invalid",
    why: "Gmail drafts.update returned a response that did not match the expected draft contract",
    fix: "Check Gmail drafts.update response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.update",
      module: "mail",
    },
  },
  GMAIL_DELETE_DRAFT_FAILED: {
    status: 200,
    message: "Gmail draft delete failed",
    why: "Gmail drafts.delete failed while discarding a draft message",
    fix: "Check draft id, response status, and Gmail access (gmail.modify) scope",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.delete",
      module: "mail",
    },
  },
  GMAIL_LIST_DRAFTS_FAILED: {
    status: 200,
    message: "Gmail draft list failed",
    why: "Gmail drafts.list failed while loading mailbox drafts",
    fix: "Check Gmail drafts response status and OAuth mailbox access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.list",
      module: "mail",
    },
  },
  GMAIL_LIST_DRAFTS_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail draft list response invalid",
    why: "Gmail drafts.list returned a response that did not match the expected list contract",
    fix: "Check Gmail drafts.list response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "drafts.list",
      module: "mail",
    },
  },
  GMAIL_MODIFY_THREAD_FAILED: {
    status: 200,
    message: "Gmail thread update failed",
    why: "Gmail threads.modify failed while changing thread labels",
    fix: "Check Gmail thread id, label ids, response status, and Gmail access (gmail.modify) scope",
    internal: {
      dependency: "gmail",
      dependencyOperation: "threads.modify",
      module: "mail",
    },
  },
  GMAIL_MODIFY_THREAD_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail thread update response invalid",
    why: "Gmail threads.modify returned a response that did not match the expected thread contract",
    fix: "Check Gmail threads.modify response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "threads.modify",
      module: "mail",
    },
  },
  GMAIL_SEND_MESSAGE_FAILED: {
    status: 200,
    message: "Gmail send failed",
    why: "Gmail messages.send failed while sending user mailbox email",
    fix: "Check recipient, MIME payload, response status, and Gmail send scope for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "messages.send",
      module: "mail",
    },
  },
  GMAIL_SEND_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail send response invalid",
    why: "Gmail messages.send returned a response that did not match the expected send contract",
    fix: "Check Gmail send response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "messages.send",
      module: "mail",
    },
  },
  GMAIL_HISTORY_LIST_FAILED: {
    status: 200,
    message: "Gmail history read failed",
    why: "Gmail users.history.list failed while reconciling mailbox changes",
    fix: "Check Gmail history cursor freshness, response status, and mailbox API access",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.history.list",
      module: "mail",
    },
  },
  GMAIL_HISTORY_EXPIRED: {
    status: 200,
    message: "Gmail history cursor expired",
    why: "Gmail users.history.list returned 404 because the stored history cursor is too old or no longer available",
    fix: "Mark the mail account for resync and rebuild the mailbox cache from a fresh Gmail snapshot",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.history.list",
      module: "mail",
    },
  },
  GMAIL_HISTORY_LIST_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail history response invalid",
    why: "Gmail users.history.list returned a response that did not match the expected history contract",
    fix: "Check Gmail history response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.history.list",
      module: "mail",
    },
  },
  GMAIL_WATCH_FAILED: {
    status: 200,
    message: "Gmail watch failed",
    why: "Gmail users.watch failed while registering mailbox push notifications",
    fix: "Check Gmail Pub/Sub topic, Gmail API permissions, and OAuth mailbox access",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.watch",
      module: "mail",
    },
  },
  MAIL_SYNC_REPOSITORY_MISSING: {
    status: 200,
    message: "Mailbox temporarily unavailable",
    why: "The authenticated request context was built without the mail sync repository that cached-mirror writes require",
    fix: "Wire createPrismaMailSyncRepository into the authenticated route context (see apps/web rpc route)",
    internal: {
      dependency: "prisma",
      dependencyOperation: "mailSyncRepository",
      module: "mail",
    },
  },
  GMAIL_WATCH_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail watch response invalid",
    why: "Gmail users.watch returned a response that did not match the expected watch contract",
    fix: "Check Gmail watch response shape and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.watch",
      module: "mail",
    },
  },
} as const);

declare module "evlog" {
  interface RegisteredErrorCatalogs {
    mail: typeof mailErrors;
  }
}
