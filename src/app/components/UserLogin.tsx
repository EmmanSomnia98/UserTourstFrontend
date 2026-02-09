import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { ArrowRight, KeyRound, Mail } from "lucide-react";

type UserLoginProps = {
  onLogin: () => void;
  onBack: () => void;
};

export function UserLogin({ onLogin, onBack }: UserLoginProps) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Sign In</h2>
          <p className="text-sm text-slate-500">Travel Itinerary Management System</p>
        </div>

        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onLogin();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="user-email"
                type="email"
                placeholder="you@email.com"
                autoComplete="email"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-password">Password</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="user-password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button type="submit" className="h-11 w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800">
              Sign in
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
