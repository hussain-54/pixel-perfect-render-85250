import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const STUDENT_CURRENT_KEY = ["student", "current"] as const;
export const STUDENT_NOTIFICATIONS_KEY = ["notifications", "student"] as const;

export type StudentLiveStatus = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Student portal Realtime: own inbox + own case rows (RLS-scoped).
 * Always reconciles via authorized server queries — never trusts payload alone.
 */
export function useStudentPortalRealtime(enabled: boolean): StudentLiveStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StudentLiveStatus>(
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
        void queryClient.invalidateQueries({ queryKey: [...STUDENT_CURRENT_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...STUDENT_NOTIFICATIONS_KEY] });
        void queryClient.invalidateQueries({ queryKey: ["student"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications", "student"] });
      }, 250);
    };

    setStatus("connecting");
    const channel = supabase
      .channel(`student-portal-${Date.now()}`)
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
            student_id?: string | null;
          } | null;
          const path = row?.link_path ?? "";
          if (path.startsWith("/student/") || Boolean(row?.student_id) || row?.id) {
            reconcile(`notif:${row?.id ?? ""}`);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_documents" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; updated_at?: string } | null;
          reconcile(`doc:${payload.eventType}:${row?.id ?? ""}:${row?.updated_at ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; updated_at?: string } | null;
          reconcile(`app:${payload.eventType}:${row?.id ?? ""}:${row?.updated_at ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; updated_at?: string } | null;
          reconcile(`appt:${payload.eventType}:${row?.id ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signup_fee_payments" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; status?: string } | null;
          reconcile(`fee:${payload.eventType}:${row?.id ?? ""}:${row?.status ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "students" },
        (payload) => {
          const row = payload.new as { id?: string; updated_at?: string } | null;
          reconcile(`stu:${row?.id ?? ""}:${row?.updated_at ?? ""}`);
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
