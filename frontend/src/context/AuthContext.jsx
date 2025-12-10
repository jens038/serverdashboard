// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // === bootstrap uit localStorage ===
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sd_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email) {
          setUser(parsed);
        }
      }
    } catch {
      // negeren
    } finally {
      setLoading(false);
    }
  }, []);

  const saveUser = (u) => {
    setUser(u);
    if (u) {
      localStorage.setItem("sd_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("sd_user");
    }
  };

  // === REGISTER: roept /api/auth/register ===
  const register = async ({ name, email, password }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        data?.message || `Registratie mislukt (status ${res.status})`;
      throw new Error(msg);
    }

    // server stuurt { user: { id, name, email } }
    const user = data.user;
    saveUser(user);
    return user;
  };

  // === LOGIN: roept /api/auth/login ===
  const login = async ({ email, password }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        data?.message || `Inloggen mislukt (status ${res.status})`;
      throw new Error(msg);
    }

    const user = data.user;
    saveUser(user);
    return user;
  };

  const logout = () => {
    saveUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
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
