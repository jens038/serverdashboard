// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bij start: vraag backend om de echte status
  useEffect(() => {
    const loadState = async () => {
      try {
        const res = await fetch("/api/auth/state", {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) {
          setUser(data.authenticated ? data.user : null);
          setSetupRequired(!!data.setupRequired);
        } else {
          setUser(null);
          setSetupRequired(true);
        }
      } catch {
        setUser(null);
        setSetupRequired(true);
      } finally {
        setLoading(false);
      }
    };

    loadState();
  }, []);

  // Eerste keer admin aanmaken
  const setupAccount = async ({ name, email, password }) => {
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || "Failed to create admin account");
    }

    setUser(data.user);
    setSetupRequired(false);
    return data.user;
  };

  // Normale login → alleen succesvol als backend 200 teruggeeft
  const login = async ({ email, password }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.setupRequired) {
        setSetupRequired(true);
      }
      throw new Error(data?.message || "Login failed");
    }

    setUser(data.user);
    setSetupRequired(false);
    return data.user;
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // negeren
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setupRequired,
        login,
        logout,
        setupAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export default AuthContext;
