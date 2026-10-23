import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { FEE_QUEUE_KEY } from "@/lib/use-fee-verification-queue-realtime";

export const FINANCE_SIGNUP_QUEUE_KEY = ["admin", "signup-fee-queue"] as const;
export const FINANCE_UNIVERSITY_QUEUE_KEY = ["admin", "university-fee-queue"] as const;
export const FINANCE_NOTIFICATIONS_KEY = ["notifications", "staff"] as const;

export type FinanceLiveStatus = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Finance workspace Realtime: signup fees, counselling fee requests, university fees, inbox.
 * Always reconciles via authorized server queries — never trusts payload alone.
 */
export function useFinanceWorkspaceRealtime(enabled: boolean): FinanceLiveStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FinanceLiveStatus>(
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
        void queryClient.invalidateQueries({ queryKey: [...FINANCE_SIGNUP_QUEUE_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...FINANCE_UNIVERSITY_QUEUE_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...FINANCE_NOTIFICATIONS_KEY] });
      }, 250);
    };

    setStatus("connecting");
    const channel = supabase
      .channel(`finance-workspace-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signup_fee_payments" },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            id?: string;
            status?: string;
            updated_at?: string;
          } | null;
          reconcile(
            `fee:${payload.eventType}:${row?.id ?? ""}:${row?.status ?? ""}:${row?.updated_at ?? ""}`,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "counselling_fee_verification_requests" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; updated_at?: string } | null;
          reconcile(`req:${payload.eventType}:${row?.id ?? ""}:${row?.updated_at ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "university_fee_obligations" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; status?: string } | null;
          reconcile(`ufee:${payload.eventType}:${row?.id ?? ""}:${row?.status ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as { id?: string; link_path?: string | null } | null;
          const path = row?.link_path ?? "";
          if (
            path.startsWith("/staff/finance") ||
            path.startsWith("/admin/finance") ||
            path.startsWith("/staff/front-desk") ||
            row?.id
          ) {
            reconcile(`notif:${row?.id ?? ""}`);
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
  }, [enabled, queryClient]);

  return status;
}
