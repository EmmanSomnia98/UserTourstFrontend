import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { registerUser, type AuthUser } from "@/app/api/auth";
import { ArrowRight, KeyRound, Mail, User } from "lucide-react";

type UserSignupProps = {
  onSignup: (session: { token?: string; user?: AuthUser }) => void;
  onBack: () => void;
};

export function UserSignup({ onSignup, onBack }: UserSignupProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">User Sign Up</h2>
          <p className="text-sm text-slate-500">Welcome to Bulusan Wanderer!</p>
        </div>

        <form
          className="mt-8 space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (password !== confirmPassword) {
              setError("Passwords do not match.");
              return;
            }
            setError(null);
            setIsSubmitting(true);
            try {
              const session = await registerUser(name, email, password);
              onSignup(session);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="signup-name">Full name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="signup-name"
                type="text"
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                className="pl-9"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="signup-email"
                type="email"
                placeholder="you@email.com"
                autoComplete="email"
                className="pl-9"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="signup-password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pl-9"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="signup-confirm"
                type="password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className="pl-9"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button type="submit" className="h-11 w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800" disabled={isSubmitting}>
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={onBack}>
              Back to Home
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
