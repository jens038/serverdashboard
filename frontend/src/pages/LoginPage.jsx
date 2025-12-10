import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, User as UserIcon } from "lucide-react";

const LoginPage = () => {
  const { setupRequired, login, setupAccount } = useAuth();
  const [mode, setMode] = useState(setupRequired ? "setup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const effectiveMode = setupRequired ? "setup" : mode;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (effectiveMode === "setup") {
        if (!email || !password) {
          throw new Error("E-mail en wachtwoord zijn verplicht.");
        }
        await setupAccount({ name, email, password });
      } else {
        await login({ email, password });
      }
    } catch (err) {
      setError(err.message || "Er ging iets mis.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="max-w-md w-full px-6 py-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">ServerDashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            {effectiveMode === "setup"
              ? "Maak je eerste admin-account aan om het dashboard te gebruiken."
              : "Log in om je ServerDashboard te bekijken."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {effectiveMode === "setup" && (
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs font-semibold uppercase text-slate-400 tracking-wider"
              >
                Naam (optioneel)
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  className="pl-9 bg-slate-900/60 border-slate-700"
                  placeholder="Admin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-xs font-semibold uppercase text-slate-400 tracking-wider"
            >
              E-mail
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                className="pl-9 bg-slate-900/60 border-slate-700"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase text-slate-400 tracking-wider"
            >
              Wachtwoord
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                className="pl-9 bg-slate-900/60 border-slate-700"
                placeholder="•••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700"
            disabled={submitting}
          >
            {submitting
              ? "Bezig..."
              : effectiveMode === "setup"
              ? "Account aanmaken"
              : "Inloggen"}
          </Button>

          {!setupRequired && (
            <div className="text-center mt-3">
              <button
                type="button"
                className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                onClick={() =>
                  setMode((m) => (m === "login" ? "setup" : "login"))
                }
              >
                {mode === "login"
                  ? "Eerste admin-account opnieuw instellen"
                  : "Terug naar login"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
