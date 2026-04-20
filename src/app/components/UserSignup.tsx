import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { registerUser, type AuthUser } from "@/app/api/auth";
import { toUserFacingErrorMessage } from "@/app/utils/user-facing-error";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail, User } from "lucide-react";

type UserSignupProps = {
  onSignup: (session: { token?: string; user?: AuthUser }) => void;
  onBack: () => void;
};

export function UserSignup({ onSignup, onBack }: UserSignupProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl">
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
              setError(
                toUserFacingErrorMessage(err, {
                  action: "create your account",
                  fallback: "Unable to create your account right now. Please try again.",
                })
              );
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
                className="pl-9 transition-colors duration-200 hover:border-slate-400 focus-visible:ring-blue-200"
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
                className="pl-9 transition-colors duration-200 hover:border-slate-400 focus-visible:ring-blue-200"
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
                type={isPasswordVisible ? "text" : "password"}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="pl-9 pr-10 transition-colors duration-200 hover:border-slate-400 focus-visible:ring-blue-200"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
              >
                {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-confirm">Confirm password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="signup-confirm"
                type={isPasswordVisible ? "text" : "password"}
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className="pl-9 pr-10 transition-colors duration-200 hover:border-slate-400 focus-visible:ring-blue-200"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                onClick={() => setIsPasswordVisible((visible) => !visible)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
              >
                {isPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button
              type="submit"
              className="h-11 w-full gap-2 bg-emerald-700 text-white transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md"
              disabled={isSubmitting}
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md"
              onClick={onBack}
            >
              Back to Home
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
