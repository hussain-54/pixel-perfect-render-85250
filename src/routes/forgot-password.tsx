import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Mail } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Global Roots Consultants" },
      {
        name: "description",
        content: "Reset your Global Roots account password.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || success) return;
    setError(null);
    setSuccess(false);
    setFieldError(null);

    if (!email.trim()) {
      setFieldError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we’ll send a secure reset link."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/sign-in"
            className="font-semibold text-royal transition-colors hover:text-navy"
          >
            ← Back to Sign In
          </Link>
        </p>
      }
    >
      {success ? (
        <div
          role="status"
          className="animate-in fade-in duration-300 rounded-md border border-royal/20 bg-accent/70 px-4 py-6 text-center"
        >
          <Mail className="mx-auto h-8 w-8 text-royal" aria-hidden />
          <p className="mt-3 font-display text-lg font-semibold text-navy">Check your email</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Check your email for instructions to reset your password.
          </p>
          <Button asChild variant="outline" className="mt-6 h-11 w-full font-semibold">
            <Link to="/sign-in">Back to Sign In</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <AuthField
            id="reset-email"
            label="Email Address"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(null);
            }}
            placeholder="you@example.com"
            error={fieldError ?? undefined}
            disabled={loading}
          />

          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending reset link...
              </>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
