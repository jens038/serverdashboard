import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Film, Tv, Play, Download, Shield, Star, Box, Server, Database, Wifi, Globe,
  HardDrive, Cpu, Activity, Terminal, Settings, Wrench, File, Folder, Cloud, Lock,
  Home, User, Zap, Camera, Image, Mail, Calendar, Clock, Music, Radio, Video,
  Headphones, Monitor, Smartphone, Code, GitBranch, Layers, Layout, Package,
  Archive, Save, Trash, Upload, RefreshCw, Cast, Link, PieChart, BarChart,
  LineChart, Table, Key, Lock as LockOpen, Eye, Gamepad, Speaker
} from "lucide-react";

const SettingsContext = createContext(null);

// ---------- ICONS ----------
export const ICON_MAP = {
  Film, Tv, Play, Music, Video, Radio, Headphones, Cast, Image, Camera, Gamepad, Speaker,
  Database, HardDrive, File, Folder, Archive, Save, Cloud, Upload, Download,
  Server, Wifi, Globe, Shield, Lock, LockOpen, Key, Link, Terminal, Code,
  Activity, Cpu, Monitor, Zap, Settings, Wrench, RefreshCw, Trash,
  PieChart, BarChart, LineChart, Table, Eye,
  Box, Star, Home, User, Mail, Calendar, Clock, Smartphone,
  Package, Layers, Layout, GitBranch,
};

export const availableIcons = Object.keys(ICON_MAP).sort();

export const getIconComponent = (name) => ICON_MAP[name] || Box;

// ⛔ defaultContainers weg: gebruiker moet zelf containers toevoegen
// const defaultContainers = [ ... ]  <-- niet meer nodig

export const SettingsProvider = ({ children }) => {
  const [containers, setContainers] = useState(() => {
    const saved = localStorage.getItem("docker-containers");
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);

      // optioneel: oude demo-containers eruit filteren als ze nog in localStorage staan
      const demoNames = ["Sonarr", "Radarr", "Plex", "qBittorrent", "AdGuard", "Overseerr"];

      if (Array.isArray(parsed)) {
        return parsed.filter((c) => !demoNames.includes(c?.name));
      }

      return [];
    } catch {
      return [];
    }
  });

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    mode: "new",
    containerIndex: null,
  });

  useEffect(() => {
    localStorage.setItem("docker-containers", JSON.stringify(containers));
  }, [containers]);

  const addContainer = (newContainer) =>
    setContainers((prev) => [...prev, newContainer]);

  const deleteContainer = (index) =>
    setContainers((prev) => prev.filter((_, i) => i !== index));

  const updateContainer = (index, updatedContainer) =>
    setContainers((prev) => prev.map((c, i) => (i === index ? updatedContainer : c)));

  const openAddDialog = () =>
    setDialogState({ isOpen: true, mode: "new", containerIndex: null });

  const openManageDialog = () =>
    setDialogState({ isOpen: true, mode: "manage", containerIndex: null });

  const openEditDialog = (index) =>
    setDialogState({ isOpen: true, mode: "edit", containerIndex: index });

  const closeDialog = () =>
    setDialogState((prev) => ({ ...prev, isOpen: false }));

  return (
    <SettingsContext.Provider
      value={{
        containers,
        addContainer,
        deleteContainer,
        updateContainer,
        dialogState,
        openAddDialog,
        openManageDialog,
        openEditDialog,
        closeDialog,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsProvider;

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
};
