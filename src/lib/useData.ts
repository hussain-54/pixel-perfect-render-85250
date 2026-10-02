import { useQuery } from "@tanstack/react-query";

/** Thin wrapper so pages read data the same way regardless of the backend. */
export function useData<T>(key: unknown[], fn: () => Promise<T>) {
  return useQuery({ queryKey: key, queryFn: fn, staleTime: 60_000 });
}
