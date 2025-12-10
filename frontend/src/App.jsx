// src/App.jsx
import { ThemeProvider } from "./components/ThemeProvider.jsx";
import { Toaster } from "./components/ui/toaster.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <DashboardPage />
        <Toaster />
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App;
