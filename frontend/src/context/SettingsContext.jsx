// frontend/src/context/SettingsContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Film, Tv, Play, Download, Shield, Star, Box, Server, Database, Wifi, Globe,
  HardDrive, Cpu, Activity, Terminal, Settings, Wrench, File, Folder, Cloud, Lock,
  Home, User, Zap, Camera, Image, Mail, Calendar, Clock, Music, Radio, Video,
  Headphones, Monitor, Smartphone, Code, GitBranch, Layers, Layout, Package,
  Archive, Save, Trash, Upload, RefreshCw, Cast, Link, PieChart, BarChart,
  LineChart, Table, Key, Eye, Gamepad, Speaker
} from "lucide-react";

const SettingsContext = createContext(null);

// ---------- ICONS ----------
export const ICON_MAP = {
  Film, Tv, Play, Music, Video, Radio, Headphones, Cast, Image, Camera, Gamepad, Speaker,
  Database, HardDrive, File, Folder, Archive, Save, Cloud, Upload, Download,
  Server, Wifi, Globe, Shield, Lock, Key, Link, Terminal, Code,
  Activity, Cpu, Monitor, Zap, Settings, Wrench, RefreshCw, Trash,
  PieChart, BarChart, LineChart, Table, Eye,
  Box, Star, Home, User, Mail, Calendar, Clock, Smartphone,
  Package, Layers, Layout, GitBranch,
};

export const availableIcons = Object.keys(ICON_MAP).sort();
export const getIconComponent = (name) => ICON_MAP[name] || Box;

export const SettingsProvider = ({ children }) => {
  const [containers, setContainers] = useState([]);
  const [loadingContainers, setLoadingContainers] = useState(true);

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    mode: "new",
    containerIndex: null,
  });

  // ---- 1) Load containers from backend (NOT localStorage) ----
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingContainers(true);
      try {
        const res = await fetch("/api/containers");
        const data = await res.json();

        if (!res.ok) throw new Error(data?.message || "Failed to load containers");
        if (!cancelled) setContainers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Load containers failed:", e);
        if (!cancelled) setContainers([]);
      } finally {
        if (!cancelled) setLoadingContainers(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ---- CRUD via backend ----
  const addContainer = async (newContainer) => {
    const res = await fetch("/api/containers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newContainer),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Failed to add container");
    setContainers((prev) => [...prev, data]);
    return data;
  };

  const updateContainer = async (index, updatedContainer) => {
    const current = containers[index];
    if (!current?.id) throw new Error("Missing container id");

    const res = await fetch(`/api/containers/${current.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedContainer),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || "Failed to update container");

    setContainers((prev) => prev.map((c, i) => (i === index ? data : c)));
    return data;
  };

  const deleteContainer = async (index) => {
    const current = containers[index];
    if (!current?.id) throw new Error("Missing container id");

    const res = await fetch(`/api/containers/${current.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || "Failed to delete container");
    }

    setContainers((prev) => prev.filter((_, i) => i !== index));
  };

  const openAddDialog = () =>
    setDialogState({ isOpen: true, mode: "new", containerIndex: null });

  const openManageDialog = () =>
    setDialogState({ isOpen: true, mode: "manage", containerIndex: null });

  const openEditDialog = (index) =>
    setDialogState({ isOpen: true, mode: "edit", containerIndex: index });

  const closeDialog = () =>
    setDialogState((prev) => ({ ...prev, isOpen: false }));

  const value = useMemo(() => ({
    containers,
    loadingContainers,
    addContainer,
    deleteContainer,
    updateContainer,
    dialogState,
    openAddDialog,
    openManageDialog,
    openEditDialog,
    closeDialog,
  }), [containers, loadingContainers, dialogState]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
