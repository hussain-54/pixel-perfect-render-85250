import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { changeOwnPassword, getAuthSession } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH, validatePasswordConfirmation } from "@/lib/password-policy";
import { portalHomeByRole } from "@/lib/roles";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/change-password")({
  head: () =>
    pageHead({
      path: "/change-password",
      title: "Change Password — Global Roots Consultants",
      description: "Change your Global Roots account password.",
      indexable: false,
    }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [mustChange, setMustChange] = useState(false);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    current?: string;
    password?: string;
    confirm?: string;
  }>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const session = await getAuthSession();
      if (cancelled) return;
      if (!session) {
        setSignedIn(false);
        setReady(true);
        return;
      }
      setSignedIn(true);
      setMustChange(Boolean(session.mustChangePassword));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    if (!mustChange && !currentPassword) {
      setFieldErrors({ current: "Enter your current password." });
      return;
    }

    const check = validatePasswordConfirmation(password, confirm);
    if (!check.ok) {
      if (/confirm/i.test(check.error)) setFieldErrors({ confirm: check.error });
      else setFieldErrors({ password: check.error });
      return;
    }

    setLoading(true);
    try {
      const result = await changeOwnPassword({
        newPassword: password,
        confirmPassword: confirm,
        ...(mustChange ? {} : { currentPassword }),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result.message);
      const session = await getAuthSession();
      const dest = session ? portalHomeByRole[session.role] : "/sign-in";
      window.setTimeout(() => {
        void navigate(dest === "/sign-in" ? { to: "/sign-in", search: {} } : { to: dest });
      }, 800);
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <AuthShell title="Change password" subtitle="Checking your session…">
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      </AuthShell>
    );
  }

  if (!signedIn) {
    return (
      <AuthShell
        title="Sign in required"
        subtitle="Sign in first, then change your password from your account."
        footer={
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-semibold text-royal transition-colors hover:text-navy"
            >
              Forgot password?
            </Link>
          </p>
        }
      >
        <Button asChild className="h-12 w-full text-base font-semibold">
          <Link to="/sign-in" search={{}}>
            Sign In
          </Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={mustChange ? "Set a new password" : "Change your password"}
      subtitle={
        mustChange
          ? `Your temporary password must be changed before you continue. Use at least ${PASSWORD_MIN_LENGTH} characters with a letter and a number.`
          : `Enter your current password, then choose a new one (min ${PASSWORD_MIN_LENGTH} characters, letter + number).`
      }
      footer={
        mustChange ? null : (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              to="/forgot-password"
              className="font-semibold text-royal transition-colors hover:text-navy"
            >
              Forgot your current password?
            </Link>
          </p>
        )
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
        {success ? (
          <div
            role="status"
            className="rounded-md border border-success/30 bg-success-soft px-3.5 py-3 text-sm text-navy"
          >
            {success}
          </div>
        ) : null}

        {!mustChange ? (
          <AuthPasswordField
            id="change-current-password"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={fieldErrors.current}
            disabled={loading}
            autoComplete="current-password"
            placeholder="Current password"
            showPassword={showCurrent}
            onToggleVisibility={() => setShowCurrent((v) => !v)}
          />
        ) : null}

        <AuthPasswordField
          id="change-new-password"
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
          id="change-confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          error={fieldErrors.confirm}
          disabled={loading}
          autoComplete="new-password"
          placeholder="Confirm new password"
          showPassword={showConfirm}
          onToggleVisibility={() => setShowConfirm((v) => !v)}
        />

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : mustChange ? (
            "Save and continue"
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
