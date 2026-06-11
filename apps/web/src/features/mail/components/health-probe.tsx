"use client";

import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/utils/orpc";

export function HealthProbe() {
  useQuery(
    orpc.healthCheck.queryOptions({
      meta: {
        silentError: true,
      },
      retry: false,
      staleTime: Number.POSITIVE_INFINITY,
    }),
  );

  return null;
}
