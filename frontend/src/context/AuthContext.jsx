import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "sd_auth";

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({ user: null, token: null });
  const [loading, setLoading] = useState(true);

  // bootstrap uit localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.user && parsed.token) {
          setAuth(parsed);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAuth = (next) => {
    setAuth(next);
    if (next && next.user && next.token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const logout = () => {
    saveAuth({ user: null, token: null });
  };

  // Eerst checken of er al users zijn
  const checkHasUsers = async () => {
    const res = await fetch("/api/auth/has-users");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || "Kon user status niet ophalen");
    }
    return !!data.hasUsers;
  };

  // Eerste admin user aanmaken (geen token nodig)
  const registerFirst = async ({ name, email, password }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || "Account aanmaken mislukt");
    }

    // server stuurt { user, token }
    if (data.user && data.token) {
      saveAuth({ user: data.user, token: data.token });
    }

    return data.user;
  };

  // Normale login
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
      throw new Error(data?.message || "Inloggen mislukt");
    }

    if (data.user && data.token) {
      saveAuth({ user: data.user, token: data.token });
    }

    return data.user;
  };

  // Admin maakt extra user aan
  const createUserAsAdmin = async ({ name, email, password }) => {
    if (!auth.token) {
      throw new Error("Geen admin-sessie");
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || "User aanmaken mislukt");
    }
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        token: auth.token,
        loading,
        checkHasUsers,
        registerFirst,
        login,
        createUserAsAdmin,
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
