import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function checkUser() {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include"
      });

      const data = await res.json();

      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    checkUser();
  }, []);

  async function login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok && data.user) {
      setUser(data.user);
      return { success: true };
    }

    return { success: false, message: data.message || "Login mislukt" };
  }

  async function registerFirst(values) {
    const res = await fetch("/api/auth/register-first", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(values)
    });

    const data = await res.json();

    if (res.ok && data.user) {
      setUser(data.user);
      return { success: true };
    }

    return { success: false, message: data.message || "Registratie mislukt" };
  }

  function logout() {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    }).finally(() => setUser(null));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerFirst }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
