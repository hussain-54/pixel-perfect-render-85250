import { useEffect, useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRememberedEmail, signInWithPassword } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign In — Global Roots Consultants" },
      {
        name: "description",
        content: "Sign in to Global Roots to access your student, consultant, or admin portal.",
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

  function validate() {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!password) next.password = "Password is required.";
    else if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
      title="Sign In to Global Roots"
      subtitle="Enter your email and password. We’ll open the correct portal for your account."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          New student?{" "}
          <Link to="/sign-up" className="font-semibold text-royal hover:text-navy">
            Create an account
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

        <div className="space-y-2">
          <Label htmlFor="sign-in-email" className="text-navy">
            Email
          </Label>
          <Input
            id="sign-in-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) {
                setFieldErrors((f) => {
                  const next = { ...f };
                  delete next.email;
                  return next;
                });
              }
            }}
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            className={cn(
              fieldErrors.email && "border-destructive focus-visible:ring-destructive/30",
            )}
            disabled={loading}
          />
          {fieldErrors.email ? (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="sign-in-password" className="text-navy">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-royal hover:text-navy"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="sign-in-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((f) => {
                    const next = { ...f };
                    delete next.password;
                    return next;
                  });
                }
              }}
              placeholder="Enter your password"
              aria-invalid={Boolean(fieldErrors.password)}
              className={cn(
                "pr-11",
                fieldErrors.password && "border-destructive focus-visible:ring-destructive/30",
              )}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-navy"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="text-xs text-destructive">{fieldErrors.password}</p>
          ) : null}
        </div>

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

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
