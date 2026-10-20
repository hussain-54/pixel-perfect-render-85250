import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const FEE_QUEUE_KEY = ["front-desk", "fee-verification-requests"] as const;

/**
 * Subscribe to counselling_fee_verification_requests (+ own notifications).
 * On event: reconcile via authorized server query (never trust payload alone).
 */
export function useFeeVerificationQueueRealtime(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;

    let cancelled = false;
    const supabase = getSupabase();

    const reconcile = () => {
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["front-desk", "dashboard"] });
    };

    const channel = supabase
      .channel(`fd-fee-vr-queue-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "counselling_fee_verification_requests",
        },
        () => reconcile(),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const row = payload.new as { link_path?: string | null } | null;
          if (row?.link_path === "/staff/front-desk") reconcile();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Reconcile on connect and after transport issues so a missed event cannot stick.
          reconcile();
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}

export { FEE_QUEUE_KEY };
