// src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [hasUsers, setHasUsers] = useState(null); // null = nog aan het checken
  const [loading, setLoading] = useState(true);

  // ---- helpers ----
  const saveUserToStorage = (u) => {
    if (!u) {
      localStorage.removeItem("sd-user");
    } else {
      localStorage.setItem("sd-user", JSON.stringify(u));
    }
  };

  // ---- eerste load: localStorage + /api/auth/has-users ----
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // 1) user uit localStorage
        const stored = localStorage.getItem("sd-user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id) {
              if (isMounted) setUser(parsed);
            }
          } catch {
            localStorage.removeItem("sd-user");
          }
        }

        // 2) check of er al users zijn
        try {
          const res = await fetch("/api/auth/has-users");
          const data = await res.json().catch(() => ({}));
          if (isMounted) {
            setHasUsers(!!data.hasUsers);
          }
        } catch {
          if (isMounted) setHasUsers(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // ---- eerste admin-account aanmaken ----
  const registerFirst = useCallback(
    async ({ name, email, password }) => {
      const res = await fetch("/api/auth/register-first", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Registreren mislukt");
      }

      const u = data.user || data; // backend stuurt { user: {...} }
      setUser(u);
      saveUserToStorage(u);
      setHasUsers(true);
      return u;
    },
    []
  );

  // ---- inloggen ----
  const login = useCallback(async ({ email, password }) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Inloggen mislukt");
    }

    const u = data.user || data;
    setUser(u);
    saveUserToStorage(u);
    return u;
  }, []);

  // ---- uitloggen ----
  const logout = useCallback(() => {
    setUser(null);
    saveUserToStorage(null);
  }, []);

  // ---- extra user aanmaken (voor admin) ----
  const createUser = useCallback(
    async ({ name, email, password, role = "user" }) => {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "User aanmaken mislukt");
      }

      return data.user;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasUsers,
        registerFirst,
        login,
        logout,
        createUser, // voor admin-profiel scherm
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
