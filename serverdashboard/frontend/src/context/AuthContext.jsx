import { createContext, useContext, useEffect, useState } from "react";
import { loginWithCredentials, fetchCurrentUser } from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // app start
  const [error, setError] = useState(null);

  useEffect(() => {
    // proberen user op te halen als er al een token is
    async function init() {
      try {
        const hasToken = !!localStorage.getItem("access_token");
        if (!hasToken) {
          setLoading(false);
          return;
        }
        const me = await fetchCurrentUser();
        setUser(me);
      } catch (err) {
        console.error(err);
        // token ongeldig -> schoonmaken
        localStorage.removeItem("access_token");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function login(email, password) {
    setError(null);
    try {
      const data = await loginWithCredentials(email, password);
      // verwacht { access_token, user }
      localStorage.setItem("access_token", data.access_token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    setUser(null);
  }

  const value = { user, loading, error, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
