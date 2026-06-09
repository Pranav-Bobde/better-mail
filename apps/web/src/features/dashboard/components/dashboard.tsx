"use client";
import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/shared/lib/auth-client";
import { orpc } from "@/shared/utils/orpc";

export default function Dashboard({
  session: _session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const privateData = useQuery(orpc.privateData.queryOptions());

  return (
    <>
      <p>API: {privateData.data?.message}</p>
    </>
  );
}
