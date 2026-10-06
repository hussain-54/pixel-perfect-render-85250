import { useState, type FormEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthField } from "@/components/auth/AuthField";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { signUpStudent } from "@/lib/auth";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Create Account — Global Roots Consultants" },
      {
        name: "description",
        content: "Create a Global Roots student account to start your study abroad journey.",
      },
    ],
  }),
  component: SignUpPage,
});

type FieldKey = "fullName" | "email" | "phone" | "password" | "confirmPassword";

function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function clearFieldError(key: FieldKey) {
    setFieldErrors((f) => {
      if (!f[key]) return f;
      const next = { ...f };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!fullName.trim()) next.fullName = "Please enter your full name.";
    if (!email.trim()) next.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!phone.trim()) next.phone = "Please enter your phone number.";
    else if (phone.replace(/\D/g, "").length < 8) {
      next.phone = "Please enter a valid phone number.";
    }
    if (!password) next.password = "Please create a password.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) next.confirmPassword = "Those passwords don't match.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || success) return;
    setError(null);
    setInfo(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await signUpStudent({ fullName, email, phone, password });
      if (result.ok) {
        setSuccess(true);
        window.setTimeout(() => {
          void navigate({ to: result.redirectTo });
        }, 1200);
        return;
      }
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
      title="Create your Global Roots account"
      subtitle="Start your journey to studying abroad."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/sign-in"
            className="font-semibold text-royal transition-colors hover:text-navy"
          >
            Sign In
          </Link>
        </p>
      }
    >
      {success ? (
        <div
          role="status"
          className="animate-in fade-in duration-300 rounded-md border border-royal/20 bg-accent/70 px-4 py-6 text-center"
        >
          <CheckCircle2 className="mx-auto h-8 w-8 text-royal" aria-hidden />
          <p className="mt-3 font-display text-lg font-semibold text-navy">
            Account created successfully.
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Taking you to your student portal…</p>
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

          <AuthField
            id="sign-up-name"
            label="Full Name"
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clearFieldError("fullName");
            }}
            placeholder="Your full name"
            error={fieldErrors.fullName}
            disabled={loading}
          />

          <AuthField
            id="sign-up-email"
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

          <AuthField
            id="sign-up-phone"
            label="Phone Number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearFieldError("phone");
            }}
            placeholder="+92 300 1234567"
            error={fieldErrors.phone}
            disabled={loading}
          />

          <AuthPasswordField
            id="sign-up-password"
            label="Password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              clearFieldError("password");
            }}
            error={fieldErrors.password}
            disabled={loading}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            showPassword={showPassword}
            onToggleVisibility={() => setShowPassword((v) => !v)}
          />

          <AuthPasswordField
            id="sign-up-confirm"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              clearFieldError("confirmPassword");
            }}
            error={fieldErrors.confirmPassword}
            disabled={loading}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            showPassword={showConfirm}
            onToggleVisibility={() => setShowConfirm((v) => !v)}
          />

          <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
