import { useQuery } from "@tanstack/react-query";

/**
 * Thin wrapper so pages read data the same way regardless of the backend.
 * Never forwards React Query's QueryFunctionContext into `fn` — service helpers
 * that accept optional ids/filters must not see the context object (Seroval).
 */
export function useData<T>(key: unknown[], fn: () => Promise<T>) {
  return useQuery({
    queryKey: key,
    queryFn: () => fn(),
    staleTime: 60_000,
  });
}
