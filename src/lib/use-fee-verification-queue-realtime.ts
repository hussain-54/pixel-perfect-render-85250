import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const FEE_QUEUE_KEY = ["front-desk", "fee-verification-requests"] as const;

export type FeeQueueLiveStatus = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Subscribe to counselling_fee_verification_requests (+ own notifications).
 * On event: reconcile via authorized server query (never trust payload alone).
 */
export function useFeeVerificationQueueRealtime(enabled: boolean): FeeQueueLiveStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FeeQueueLiveStatus>(
    enabled && isSupabaseConfigured() ? "connecting" : "offline",
  );

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) {
      setStatus("offline");
      return;
    }

    let cancelled = false;
    const supabase = getSupabase();

    const reconcile = () => {
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["front-desk", "dashboard"] });
    };

    setStatus("connecting");
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
      .subscribe((next) => {
        if (cancelled) return;
        if (next === "SUBSCRIBED") {
          setStatus("live");
          reconcile();
        } else if (next === "CHANNEL_ERROR" || next === "TIMED_OUT") {
          setStatus("reconnecting");
          reconcile();
        } else if (next === "CLOSED") {
          setStatus("offline");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") reconcile();
    };
    const onOnline = () => {
      setStatus("reconnecting");
      reconcile();
    };
    const onOffline = () => setStatus("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  return status;
}

export { FEE_QUEUE_KEY };
