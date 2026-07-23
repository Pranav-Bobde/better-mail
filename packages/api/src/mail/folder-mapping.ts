import type { MailFolder } from "./contracts";

type GmailCategoryFolder = Extract<MailFolder, "forums" | "promotions" | "social" | "updates">;

type GmailFolderListParams = {
  readonly extraQuery?: string;
  readonly includeSpamTrash?: boolean;
  readonly labelIds: readonly string[];
};

export const gmailCategoryLabelByFolder = {
  forums: "CATEGORY_FORUMS",
  promotions: "CATEGORY_PROMOTIONS",
  social: "CATEGORY_SOCIAL",
  updates: "CATEGORY_UPDATES",
} satisfies Record<GmailCategoryFolder, string>;

export function getGmailFolderListParams(folder: MailFolder) {
  switch (folder) {
    case "inbox":
      return { labelIds: ["INBOX"] } satisfies GmailFolderListParams;
    case "drafts":
      return { labelIds: ["DRAFT"] } satisfies GmailFolderListParams;
    case "sent":
      return { labelIds: ["SENT"] } satisfies GmailFolderListParams;
    case "junk":
      return {
        includeSpamTrash: true,
        labelIds: ["SPAM"],
      } satisfies GmailFolderListParams;
    case "trash":
      return {
        includeSpamTrash: true,
        labelIds: ["TRASH"],
      } satisfies GmailFolderListParams;
    case "archive":
      return {
        extraQuery: "-in:inbox -in:trash -in:spam -in:draft",
        labelIds: [],
      } satisfies GmailFolderListParams;
    case "social":
    case "updates":
    case "forums":
    case "promotions":
      return {
        labelIds: [gmailCategoryLabelByFolder[folder]],
      } satisfies GmailFolderListParams;
    default:
      return folder satisfies never;
  }
}
