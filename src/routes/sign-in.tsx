import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getRememberedEmail, signInWithPassword } from "@/lib/auth";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign In — Global Roots Consultants" },
      {
        name: "description",
        content: "Sign in to Global Roots to continue your application journey.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const remembered = getRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRemember(true);
    }
  }, []);

  function clearFieldError(key: "email" | "password") {
    setFieldErrors((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!password) next.password = "Please enter your password.";
    else if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await signInWithPassword({ email, password, remember });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: result.redirectTo });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back to Global Roots"
      subtitle="Sign in to continue your application journey."
      footer={
        <div className="space-y-4">
          <Button asChild variant="outline" className="h-12 w-full text-base font-semibold">
            <Link to="/sign-up">Create New Account</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Consultant and admin access opens automatically for authorised accounts.
          </p>
        </div>
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

        <AuthField
          id="sign-in-email"
          label="Email Address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearFieldError("email");
          }}
          placeholder="you@example.com"
          error={fieldErrors.email}
          disabled={loading}
        />

        <AuthPasswordField
          id="sign-in-password"
          label="Password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            clearFieldError("password");
          }}
          error={fieldErrors.password}
          disabled={loading}
          autoComplete="current-password"
          placeholder="Enter your password"
          showPassword={showPassword}
          onToggleVisibility={() => setShowPassword((v) => !v)}
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="sign-in-remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              disabled={loading}
            />
            <Label htmlFor="sign-in-remember" className="cursor-pointer font-normal text-navy/80">
              Remember me
            </Label>
          </div>
          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-royal transition-colors hover:text-navy"
          >
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
