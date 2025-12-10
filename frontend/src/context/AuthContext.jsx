// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasUsers, setHasUsers] = useState(false); // bestaat er al een user?

  // Init: lees user uit localStorage + check of er al users zijn
  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem("serverdashboard-user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) {
              setUser(parsed);
            }
          } catch (e) {
            console.error("Kon opgeslagen user niet parsen:", e);
          }
        }
      } catch (e) {
        console.error("Kon localStorage niet lezen:", e);
      }

      try {
        const res = await fetch("/api/auth/has-users");
        if (res.ok) {
          const data = await res.json();
          setHasUsers(!!data.hasUsers);
        } else {
          console.error("has-users response:", res.status);
        }
      } catch (e) {
        console.error("Kon /api/auth/has-users niet opvragen:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // helper om user overal gelijk op te slaan
  const storeUser = (u) => {
    setUser(u);
    try {
      localStorage.setItem("serverdashboard-user", JSON.stringify(u));
    } catch (e) {
      console.error("Kon user niet in localStorage opslaan:", e);
    }
  };

  // eerste admin-account aanmaken
  const registerFirst = async ({ name, email, password }) => {
    const res = await fetch("/api/auth/register-first", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Registratie mislukt");
    }
    if (!data.user) {
      throw new Error("Ongeldig registratieresponse (geen user)");
    }

    storeUser(data.user);
    setHasUsers(true);
    return data.user;
  };

  // inloggen
  const login = async ({ email, password }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Inloggen mislukt");
    }
    if (!data.user) {
      throw new Error("Ongeldig loginresponse (geen user)");
    }

    storeUser(data.user);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("serverdashboard-user");
    } catch (e) {
      console.error("Kon user niet uit localStorage verwijderen:", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasUsers,
        registerFirst,
        login,
        logout,
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
