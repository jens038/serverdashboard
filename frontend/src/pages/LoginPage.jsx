// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock } from "lucide-react";

const LoginPage = () => {
  const { hasUsers, registerFirst, login, loading } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (!hasUsers) {
        // eerste admin aanmaken
        await registerFirst({
          name: form.name,
          email: form.email,
          password: form.password,
        });
        toast({
          title: "Admin aangemaakt",
          description: "Je bent nu ingelogd als eerste admin.",
        });
      } else {
        // normaal inloggen
        await login({
          email: form.email,
          password: form.password,
        });
        toast({
          title: "Ingelogd",
          description: "Welkom terug.",
        });
      }
      // Geen expliciete redirect nodig:
      // App.jsx ziet dat user niet meer null is en toont DashboardPage.
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Fout bij inloggen",
        description: err.message || "Er ging iets mis.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const title = hasUsers ? "Server Dashboard" : "ServerDashboard";
  const subtitle = hasUsers
    ? "Log in met je bestaande account."
    : "Maak je eerste admin-account aan om het dashboard te gebruiken.";
  const buttonLabel = hasUsers ? "Inloggen" : "Admin-account aanmaken";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050816] text-slate-50">
      <div className="w-full max-w-lg bg-slate-950/70 border border-slate-800 rounded-3xl shadow-xl px-8 py-10">
        <h1 className="text-3xl font-bold mb-2 text-center">{title}</h1>
        <p className="text-sm text-slate-400 mb-8 text-center">{subtitle}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!hasUsers && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs text-slate-300">
                NAAM (OPTIONEEL)
              </Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={form.name}
                  onChange={onChange}
                  className="pl-9 bg-slate-900/60 border-slate-700 focus-visible:ring-blue-500"
                  placeholder="Jouw naam"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-slate-300">
              E-MAIL
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={onChange}
                className="pl-9 bg-slate-900/60 border-slate-700 focus-visible:ring-blue-500"
                placeholder="jij@voorbeeld.nl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs text-slate-300">
              WACHTWOORD
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={hasUsers ? "current-password" : "new-password"}
                required
                value={form.password}
                onChange={onChange}
                className="pl-9 bg-slate-900/60 border-slate-700 focus-visible:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
            disabled={submitting || loading}
          >
            {submitting ? "Bezig..." : buttonLabel}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
