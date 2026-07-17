/**
 * TEMPORARY diagnostic route. Delete once the P2028 region measurement is signed off.
 *
 * Reads BENCH_DATABASE_URL / BENCH_TOKEN straight from process.env rather than the
 * validated env schema: both are throwaway and must never exist in production, so adding
 * them to the schema (required by default, per AGENTS.md) would be wrong. Returns 404
 * when either is unset, so this file is inert if it ever reaches production.
 */
import { runP2028Bench } from "@code-main/api/mail/bench-p2028";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const connectionString = process.env.BENCH_DATABASE_URL;
  const token = process.env.BENCH_TOKEN;

  if (!connectionString || !token) {
    return new Response("Not found", { status: 404 });
  }

  if (new URL(request.url).searchParams.get("token") !== token) {
    return new Response("Not found", { status: 404 });
  }

  const bench = await runP2028Bench({ connectionString, trialsPerCell: 3 });

  return Response.json({ ...bench, region: process.env.VERCEL_REGION ?? "unknown" });
}
