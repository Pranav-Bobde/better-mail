import { env } from "@code-main/env/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { mailErrors } from "./errors";
import { gmailDemoStateSchema } from "./gmail-schemas";

export async function readGmailDemoState() {
  try {
    const content = await readFile(getGmailDemoStateFilePath(), "utf8");
    const parsedState = gmailDemoStateSchema.safeParse(JSON.parse(content));

    if (parsedState.success) {
      return parsedState.data;
    }
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      return null;
    }
  }

  return null;
}

export async function writeGmailDemoState(state: {
  readonly emailAddress?: string;
  readonly historyId?: string;
  readonly watchExpiration?: string;
}) {
  const nextState = gmailDemoStateSchema.parse({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  const stateFilePath = getGmailDemoStateFilePath();

  try {
    await mkdir(getGmailDemoStateFileDirectory(stateFilePath), { recursive: true });
    await writeFile(stateFilePath, JSON.stringify(nextState, null, 2), "utf8");
  } catch (error) {
    throw mailErrors.GMAIL_STATE_WRITE_FAILED({
      cause: getErrorCause(error),
      internal: {
        stateFilePath,
      },
    });
  }

  return nextState;
}

function getGmailDemoStateFilePath() {
  return env.GMAIL_DEMO_STATE_FILE;
}

function getGmailDemoStateFileDirectory(stateFilePath: string) {
  return stateFilePath.split("/").slice(0, -1).join("/") || ".";
}

function isFileNotFoundError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return error.code === "ENOENT";
}

function getErrorCause(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Unknown Gmail state write failure");
}
