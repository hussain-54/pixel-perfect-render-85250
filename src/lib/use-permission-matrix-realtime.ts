import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BusinessRole } from "@/lib/business-permissions";
import {
  ADMIN_PERMISSION_MATRIX_QUERY_KEY,
  mapPermissionMatrixChannelStatus,
  shouldInvalidateEffectiveAccessForMatrixEvent,
  STAFF_EFFECTIVE_ACCESS_QUERY_KEY,
  type PermissionMatrixChangeRow,
  type PermissionMatrixLiveStatus,
} from "@/lib/permission-matrix-realtime-rules";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Subscribe to business_module_permissions changes for the viewer's business role.
 * On event: invalidate + refetch effective-access via authorized server fn (never trust payload).
 * Focus + online listeners remain as fallbacks when Realtime is unavailable.
 */
export function usePermissionMatrixRealtime(opts: {
  enabled: boolean;
  businessRole: BusinessRole | null | undefined;
}): PermissionMatrixLiveStatus {
  const queryClient = useQueryClient();
  const businessRole = opts.businessRole ?? null;
  const [status, setStatus] = useState<PermissionMatrixLiveStatus>(() => {
    if (!opts.enabled || !isSupabaseConfigured()) return "unsupported";
    if (!businessRole) return "offline";
    return "connecting";
  });

  useEffect(() => {
    if (!opts.enabled || !isSupabaseConfigured()) {
      setStatus("unsupported");
      return;
    }
    if (!businessRole) {
      setStatus("offline");
      return;
    }

    let cancelled = false;
    const supabase = getSupabase();

    const reconcile = () => {
      if (cancelled) return;
      void queryClient.invalidateQueries({ queryKey: [...STAFF_EFFECTIVE_ACCESS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [...ADMIN_PERMISSION_MATRIX_QUERY_KEY] });
      void queryClient.refetchQueries({ queryKey: [...STAFF_EFFECTIVE_ACCESS_QUERY_KEY] });
    };

    setStatus("connecting");
    const channel = supabase
      .channel(`biz-perm-matrix:${businessRole}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_module_permissions",
          filter: `business_role=eq.${businessRole}`,
        },
        (payload) => {
          const ok = shouldInvalidateEffectiveAccessForMatrixEvent({
            businessRole,
            newRow: (payload.new as PermissionMatrixChangeRow | null) ?? null,
            oldRow: (payload.old as PermissionMatrixChangeRow | null) ?? null,
          });
          // Filter already scopes to role; still reconcile only when payload matches.
          if (ok || payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            reconcile();
          }
        },
      )
      .subscribe((next) => {
        if (cancelled) return;
        const mapped = mapPermissionMatrixChannelStatus(next);
        setStatus(mapped);
        if (mapped === "live" || mapped === "reconnecting") {
          // Catch up after subscribe / reconnect — authorized refetch, not event trust.
          reconcile();
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
  }, [opts.enabled, businessRole, queryClient]);

  return status;
}
