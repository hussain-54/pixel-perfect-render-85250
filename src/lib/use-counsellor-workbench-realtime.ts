import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const COUNSELLOR_DASHBOARD_KEY = ["officer", "dashboard"] as const;
export const COUNSELLOR_STUDENTS_KEY = ["officer", "students-directory"] as const;
export const COUNSELLOR_NOTIFICATIONS_KEY = ["notifications", "staff"] as const;
export const COUNSELLOR_PROFILE_KEY = ["officer", "student-profile"] as const;
export const APPLICATIONS_PIPELINE_KEY = ["officer", "applications-pipeline"] as const;
export const ADMISSION_HANDOVERS_KEY = ["officer", "admission-handovers"] as const;

export type CounsellorLiveStatus = "connecting" | "live" | "reconnecting" | "offline";

/**
 * Counsellor workbench Realtime: own notifications + assigned-student updates.
 * Always reconciles via authorized server queries — never trusts payload alone.
 */
export function useCounsellorWorkbenchRealtime(enabled: boolean): CounsellorLiveStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CounsellorLiveStatus>(
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
        void queryClient.invalidateQueries({ queryKey: [...COUNSELLOR_DASHBOARD_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...COUNSELLOR_STUDENTS_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...COUNSELLOR_NOTIFICATIONS_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...COUNSELLOR_PROFILE_KEY] });
        void queryClient.invalidateQueries({ queryKey: ["officer", "student-profile"] });
        void queryClient.invalidateQueries({ queryKey: ["officer", "signup-fee"] });
        void queryClient.invalidateQueries({ queryKey: [...APPLICATIONS_PIPELINE_KEY] });
        void queryClient.invalidateQueries({ queryKey: [...ADMISSION_HANDOVERS_KEY] });
        void queryClient.invalidateQueries({ queryKey: ["officer", "application-detail"] });
      }, 250);
    };

    setStatus("connecting");
    const channel = supabase
      .channel(`counsellor-workbench-${Date.now()}`)
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
          if (
            path.startsWith("/staff/students") ||
            path.startsWith("/staff/dashboard") ||
            path.startsWith("/staff/tasks") ||
            path.startsWith("/staff/documents") ||
            path.startsWith("/staff/applications") ||
            path.startsWith("/staff/offers") ||
            Boolean(row?.student_id)
          ) {
            reconcile(`notif:${row?.id ?? ""}`);
          } else if (row?.id) {
            reconcile(`notif-inbox:${row.id}`);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "counselling_fee_verification_requests",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; updated_at?: string } | null;
          reconcile(`fee:${payload.eventType}:${row?.id ?? ""}:${row?.updated_at ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admission_handovers",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { id?: string; student_id?: string } | null;
          reconcile(`hand:${payload.eventType}:${row?.id ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            id?: string;
            updated_at?: string;
            student_id?: string;
          } | null;
          reconcile(`app:${payload.eventType}:${row?.id ?? ""}:${row?.updated_at ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "application_stage_history",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            id?: string;
            application_id?: string;
          } | null;
          reconcile(`apphist:${payload.eventType}:${row?.id ?? ""}`);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "students",
        },
        (payload) => {
          const row = payload.new as { id?: string; updated_at?: string } | null;
          // RLS limits to authorized students; still refetch via authorized APIs.
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
