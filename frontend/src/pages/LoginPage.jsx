import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, User as UserIcon } from "lucide-react";

const LoginPage = () => {
  const { checkHasUsers, registerFirst, login } = useAuth();
  const { toast } = useToast();

  const [hasUsers, setHasUsers] = useState(null); // null = loading
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const v = await checkHasUsers();
        setHasUsers(v);
      } catch (err) {
        console.error(err);
        setHasUsers(true); // fallback: geen eerste-setup flow
      }
    })();
  }, [checkHasUsers]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      if (!hasUsers) {
        // eerste admin account
        await registerFirst({
          name: form.name,
          email: form.email,
          password: form.password,
        });
        toast({
          title: "Admin-account aangemaakt",
          description: "Je bent nu ingelogd als admin.",
        });
      } else {
        await login({
          email: form.email,
          password: form.password,
        });
        toast({
          title: "Ingelogd",
          description: "Welkom terug.",
        });
      }
    } catch (err) {
      setErrorMsg(err.message || "Er is iets misgegaan.");
    } finally {
      setSubmitting(false);
    }
  };

  const isFirstTime = hasUsers === false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 backdrop-blur-xl p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-2 text-center">
          Server Dashboard
        </h1>
        <p className="text-xs text-slate-400 mb-6 text-center">
          {hasUsers === null
            ? "Bezig met controleren..."
            : isFirstTime
            ? "Maak je eerste admin-account aan om het dashboard te gebruiken."
            : "Log in met je bestaande account."}
        </p>

        {hasUsers === null ? (
          <p className="text-xs text-slate-400 text-center">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isFirstTime && (
              <div className="space-y-1">
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
                    value={form.name}
                    onChange={handleChange("name")}
                    className="pl-9 bg-slate-900/60 border-slate-700"
                    placeholder="Jouw naam"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
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
                  value={form.email}
                  onChange={handleChange("email")}
                  className="pl-9 bg-slate-900/60 border-slate-700"
                  placeholder="jij@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
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
                  value={form.password}
                  onChange={handleChange("password")}
                  className="pl-9 bg-slate-900/60 border-slate-700"
                  placeholder="••••••••"
                  autoComplete={isFirstTime ? "new-password" : "current-password"}
                  required
                />
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs text-red-300 bg-red-900/40 border border-red-500/60 rounded-md px-3 py-2">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
            >
              {submitting
                ? "Bezig..."
                : isFirstTime
                ? "Admin-account aanmaken"
                : "Inloggen"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
