import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpStudent } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Create Account — Global Roots Consultants" },
      {
        name: "description",
        content: "Create a Global Roots student account to track your study abroad journey.",
      },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});

  function validate() {
    const next: { fullName?: string; email?: string; password?: string } = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!password) next.password = "Password is required.";
    else if (password.length < 8) next.password = "Use at least 8 characters.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await signUpStudent({ fullName, email, password });
      if (result.ok) {
        await navigate({ to: result.redirectTo });
        return;
      }
      // Confirmation-required path still surfaces as a soft message
      if (result.error.toLowerCase().includes("check your email")) {
        setInfo(result.error);
        return;
      }
      setError(result.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Student accounts start here. Consultant and admin access is issued by Global Roots."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/sign-in" className="font-semibold text-royal hover:text-navy">
            Sign In
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
        {info ? (
          <div
            role="status"
            className="rounded-md border border-royal/25 bg-accent/60 px-3.5 py-3 text-sm text-navy"
          >
            {info}{" "}
            <Link to="/sign-in" className="font-semibold text-royal hover:text-navy">
              Go to Sign In
            </Link>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="sign-up-name" className="text-navy">
            Full name
          </Label>
          <Input
            id="sign-up-name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) {
                setFieldErrors((f) => {
                  const next = { ...f };
                  delete next.fullName;
                  return next;
                });
              }
            }}
            placeholder="Your full name"
            className={cn(fieldErrors.fullName && "border-destructive")}
            disabled={loading}
          />
          {fieldErrors.fullName ? (
            <p className="text-xs text-destructive">{fieldErrors.fullName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sign-up-email" className="text-navy">
            Email
          </Label>
          <Input
            id="sign-up-email"
            type="email"
            autoComplete="email"
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
            className={cn(fieldErrors.email && "border-destructive")}
            disabled={loading}
          />
          {fieldErrors.email ? (
            <p className="text-xs text-destructive">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sign-up-password" className="text-navy">
            Password
          </Label>
          <div className="relative">
            <Input
              id="sign-up-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
              placeholder="At least 8 characters"
              className={cn("pr-11", fieldErrors.password && "border-destructive")}
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

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Prefer to speak with a consultant first?{" "}
          <Link to="/contact" className="font-semibold text-royal hover:text-navy">
            Book a free consultation
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
