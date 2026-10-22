import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const FEE_QUEUE_KEY = ["front-desk", "fee-verification-requests"] as const;
const DASHBOARD_KEY = ["front-desk", "dashboard"] as const;
const NOTIFICATIONS_KEY = ["notifications", "staff"] as const;
const INTAKE_KEY = ["front-desk", "intake"] as const;

export type FeeQueueLiveStatus = "connecting" | "live" | "reconnecting" | "offline";

export type FrontDeskRealtimeOptions = {
  /** Also invalidate staff notification inbox queries. Default true. */
  invalidateNotifications?: boolean;
};

/**
 * Subscribe to counselling_fee_verification_requests (+ own notifications).
 * On event: reconcile via authorized server query (never trust payload alone).
 * Deduplicates bursts; cleans up on unmount; refetches on focus/reconnect.
 */
export function useFeeVerificationQueueRealtime(
  enabled: boolean,
  options?: FrontDeskRealtimeOptions,
): FeeQueueLiveStatus {
  const queryClient = useQueryClient();
  const invalidateNotifications = options?.invalidateNotifications !== false;
  const [status, setStatus] = useState<FeeQueueLiveStatus>(
    enabled && isSupabaseConfigured() ? "connecting" : "offline",
  );
  const lastEventKeyRef = useRef<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) {
      setStatus("offline");
      return;
    }

    let cancelled = false;
    const supabase = getSupabase();

    const reconcile = (eventKey?: string) => {
      if (cancelled) return;
      if (eventKey) {
        if (eventKey === lastEventKeyRef.current) return;
        lastEventKeyRef.current = eventKey;
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...DASHBOARD_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...INTAKE_KEY] });
        void queryClient.invalidateQueries({ queryKey: ["front-desk", "record"] });
        if (invalidateNotifications) {
          void queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY] });
        }
      }, 250);
    };

    setStatus("connecting");
    const channel = supabase
      .channel(`fd-workspace-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "counselling_fee_verification_requests",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; updated_at?: string } | null;
          const key = `fee:${payload.eventType}:${row?.id ?? ""}:${row?.updated_at ?? ""}`;
          reconcile(key);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            link_path?: string | null;
            user_id?: string | null;
          } | null;
          // Own-inbox RLS still applies; filter noisy unrelated inserts client-side.
          if (
            row?.link_path === "/staff/front-desk" ||
            row?.link_path?.startsWith("/staff/intake")
          ) {
            reconcile(`notif:${row.id ?? ""}`);
          } else if (invalidateNotifications && row?.id) {
            // Still refresh inbox count for other authorized staff notifications.
            reconcile(`notif-inbox:${row.id}`);
          }
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
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void supabase.removeChannel(channel);
    };
  }, [enabled, invalidateNotifications, queryClient]);

  return status;
}

export { FEE_QUEUE_KEY, DASHBOARD_KEY, NOTIFICATIONS_KEY, INTAKE_KEY };
