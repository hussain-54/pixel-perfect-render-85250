import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { updatePasswordFromRecovery } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { pageHead } from "@/lib/seo";

type RecoveryState = "loading" | "ready" | "invalid" | "expired" | "success";

export const Route = createFileRoute("/reset-password")({
  head: () =>
    pageHead({
      path: "/reset-password",
      title: "Set New Password — Global Roots Consultants",
      description: "Set a new password for your Global Roots account.",
      indexable: false,
    }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<RecoveryState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    async function resolveRecoverySession() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setState("invalid");
        return;
      }

      const supabase = getSupabase();

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (event === "PASSWORD_RECOVERY" && session) {
          setState("ready");
          return;
        }
        if (event === "SIGNED_IN" && session) {
          // PKCE / hash exchange may surface as SIGNED_IN; allow password form.
          setState((prev) => (prev === "loading" ? "ready" : prev));
        }
      });

      try {
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionErr) {
          setState("invalid");
          return;
        }
        if (data.session) {
          setState("ready");
          return;
        }
        // Give detectSessionInUrl a moment to finish exchanging the link.
        timeoutId = window.setTimeout(async () => {
          if (cancelled) return;
          const again = await supabase.auth.getSession();
          if (cancelled) return;
          if (again.data.session) setState("ready");
          else setState("expired");
        }, 1500);
      } catch {
        if (!cancelled) setState("invalid");
      }

      return () => {
        subscription.unsubscribe();
      };
    }

    let cleanup: (() => void) | undefined;
    void resolveRecoverySession().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      cleanup?.();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || state !== "ready") return;
    setError(null);
    setFieldErrors({});

    const check = validatePasswordConfirmation(password, confirm);
    if (!check.ok) {
      if (/confirm/i.test(check.error)) setFieldErrors({ confirm: check.error });
      else setFieldErrors({ password: check.error });
      return;
    }

    setLoading(true);
    try {
      const result = await updatePasswordFromRecovery(password, confirm);
      if (!result.ok) {
        if (/expired|invalid/i.test(result.error)) {
          setState(/expired/i.test(result.error) ? "expired" : "invalid");
        }
        setError(result.error);
        return;
      }
      setState("success");
    } finally {
      setLoading(false);
    }
  }

  if (state === "loading") {
    return (
      <AuthShell
        title="Verifying reset link"
        subtitle="Please wait while we validate your session."
      >
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Checking recovery link…
        </div>
      </AuthShell>
    );
  }

  if (state === "invalid" || state === "expired") {
    return (
      <AuthShell
        title={state === "expired" ? "Reset link expired" : "Invalid reset link"}
        subtitle={
          state === "expired"
            ? "This password reset link has expired. Request a new one from the sign-in screen."
            : "This password reset link is invalid or incomplete. Request a new one from the sign-in screen."
        }
        footer={
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-semibold text-royal transition-colors hover:text-navy"
            >
              Request a new reset link
            </Link>
          </p>
        }
      >
        <Button asChild variant="outline" className="h-11 w-full font-semibold">
          <Link to="/sign-in" search={{}}>
            Back to Sign In
          </Link>
        </Button>
      </AuthShell>
    );
  }

  if (state === "success") {
    return (
      <AuthShell
        title="Password updated"
        subtitle="Your new password is saved. Sign in to continue."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/sign-in"
              search={{}}
              className="font-semibold text-royal transition-colors hover:text-navy"
            >
              Continue to Sign In
            </Link>
          </p>
        }
      >
        <Button
          type="button"
          className="h-12 w-full text-base font-semibold"
          onClick={() => void navigate({ to: "/sign-in", search: {} })}
        >
          Sign In
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`Use at least ${PASSWORD_MIN_LENGTH} characters with a letter and a number.`}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/sign-in"
            search={{}}
            className="font-semibold text-royal transition-colors hover:text-navy"
          >
            ← Back to Sign In
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <AuthPasswordField
          id="reset-new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          disabled={loading}
          autoComplete="new-password"
          placeholder="New password"
          showPassword={showPassword}
          onToggleVisibility={() => setShowPassword((v) => !v)}
        />
        <AuthPasswordField
          id="reset-confirm-password"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          error={fieldErrors.confirm}
          disabled={loading}
          autoComplete="new-password"
          placeholder="Confirm password"
          showPassword={showConfirm}
          onToggleVisibility={() => setShowConfirm((v) => !v)}
        />

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
