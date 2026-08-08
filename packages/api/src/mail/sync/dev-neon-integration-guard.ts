export const confirmedDevNeonHost = "ep-old-dawn-aou3woud-pooler.c-2.ap-southeast-1.aws.neon.tech";

export function assertConfirmedDevNeonDatabaseUrl(databaseUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing dev Neon integration test: DATABASE_URL is not a valid URL");
  }

  const isPostgres = parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
  const isConfirmedHost = parsed.hostname === confirmedDevNeonHost;
  const isConfirmedDatabase = parsed.pathname === "/neondb";

  if (!isPostgres || !isConfirmedHost || !isConfirmedDatabase) {
    throw new Error(
      `Refusing dev Neon integration test: expected ${confirmedDevNeonHost}/neondb, received ${parsed.hostname}${parsed.pathname}`,
    );
  }

  return parsed;
}
