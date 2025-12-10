// src/App.jsx
import { useAuth } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./components/ThemeProvider.jsx";
import { Toaster } from "./components/ui/toaster.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Bezig met laden...</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <SettingsProvider>
        {user ? <DashboardPage /> : <LoginPage />}
        <Toaster />
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
