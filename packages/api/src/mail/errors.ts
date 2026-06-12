import { defineErrorCatalog } from "evlog";

export const mailErrors = defineErrorCatalog("mail", {
  GMAIL_ACCESS_TOKEN_REQUEST_FAILED: {
    status: 200,
    message: "Gmail auth failed",
    why: "OAuth token endpoint request failed while refreshing the demo mailbox access token",
    fix: "Check Google OAuth client credentials and refresh token for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "oauthToken",
      module: "mail",
    },
  },
  GMAIL_ACCESS_TOKEN_RESPONSE_INVALID: {
    status: 200,
    message: "Gmail auth response invalid",
    why: "OAuth token endpoint returned a response that did not match the expected token contract",
    fix: "Check OAuth response shape, scopes, and client credentials for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "oauthToken",
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
    why: "Gmail users.getProfile failed while loading demo mailbox identity",
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
    why: "Gmail messages.list failed while loading demo mailbox messages",
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
  GMAIL_NOT_CONFIGURED: {
    status: 200,
    message: "Gmail is not configured",
    why: "Required demo Gmail OAuth env keys were not available for this request",
    fix: "Set Gmail OAuth client id, client secret, and refresh token in the app env",
    internal: {
      dependency: "gmail",
      module: "mail",
    },
  },
  GMAIL_PUBSUB_PUSH_INVALID: {
    status: 200,
    message: "Gmail push payload invalid",
    why: "Pub/Sub push payload did not match the expected Gmail notification contract",
    fix: "Check Pub/Sub subscription payload, push endpoint, and parser fixture for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "pubsub.push",
      module: "mail",
    },
  },
  GMAIL_SEND_MESSAGE_FAILED: {
    status: 200,
    message: "Gmail send failed",
    why: "Gmail messages.send failed while sending demo mailbox email",
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
  GMAIL_STATE_WRITE_FAILED: {
    status: 200,
    message: "Gmail state save failed",
    why: "Local Gmail demo state file write failed while saving watch history",
    fix: "Check state file path permissions for this request",
    internal: {
      dependency: "filesystem",
      dependencyOperation: "writeFile",
      module: "mail",
    },
  },
  GMAIL_WATCH_FAILED: {
    status: 200,
    message: "Gmail watch failed",
    why: "Gmail users.watch failed while starting demo mailbox push notifications",
    fix: "Check Pub/Sub topic, Gmail publish permission, response status, and OAuth mailbox access for this request",
    internal: {
      dependency: "gmail",
      dependencyOperation: "users.watch",
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
