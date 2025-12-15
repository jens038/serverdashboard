// frontend/src/context/SettingsContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Film, Tv, Play, Music, Video, Radio, Headphones, Cast, Image, Camera, Gamepad, Speaker,
  Database, HardDrive, File, Folder, Archive, Save, Cloud, Upload, Download,
  Server, Wifi, Globe, Shield, Lock,
  Home, User, Zap, Monitor, Code, GitBranch, Layers, Layout, Package,
  Activity, Cpu, Settings, Wrench, RefreshCw, Trash,
  PieChart, BarChart, LineChart, Table, Key, Eye, Box, Star, Mail, Calendar, Clock, Smartphone
} from "lucide-react";

const SettingsContext = createContext(null);

// ---------- ICONS ----------
export const ICON_MAP = {
  Film, Tv, Play, Music, Video, Radio, Headphones, Cast, Image, Camera, Gamepad, Speaker,
  Database, HardDrive, File, Folder, Archive, Save, Cloud, Upload, Download,
  Server, Wifi, Globe, Shield, Lock, Key, Eye,
  Activity, Cpu, Monitor, Zap, Settings, Wrench, RefreshCw, Trash,
  PieChart, BarChart, LineChart, Table,
  Box, Star, Home, User, Mail, Calendar, Clock, Smartphone,
  Package, Layers, Layout, GitBranch, Code,
};

export const availableIcons = Object.keys(ICON_MAP).sort();
export const getIconComponent = (name) => ICON_MAP[name] || Box;

// ---------- API helpers ----------
async function apiJson(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const SettingsProvider = ({ children }) => {
  const [containers, setContainers] = useState([]);
  const [loadingContainers, setLoadingContainers] = useState(true);

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    mode: "new",
    containerIndex: null,
  });

  // Load containers from backend (1 bron van waarheid)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingContainers(true);
        const data = await apiJson("/api/containers");
        if (!cancelled) setContainers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setContainers([]);
      } finally {
        if (!cancelled) setLoadingContainers(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addContainer = async (newContainer) => {
    const created = await apiJson("/api/containers", {
      method: "POST",
      body: JSON.stringify(newContainer),
    });
    setContainers((prev) => [...prev, created]);
    return created;
  };

  const deleteContainer = async (index) => {
    const item = containers[index];
    if (!item?.id) throw new Error("Container id missing");
    await fetch(`/api/containers/${item.id}`, { method: "DELETE" });
    setContainers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateContainer = async (index, updatedContainer) => {
    const item = containers[index];
    if (!item?.id) throw new Error("Container id missing");

    const saved = await apiJson(`/api/containers/${item.id}`, {
      method: "PUT",
      body: JSON.stringify(updatedContainer),
    });

    setContainers((prev) => prev.map((c, i) => (i === index ? saved : c)));
    return saved;
  };

  // ✅ Reorder: move up/down + persist
  const moveContainer = async (fromIndex, direction) => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= containers.length) return;

    // Optimistisch UI
    const next = [...containers];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setContainers(next);

    // Persist naar backend
    try {
      const orderedIds = next.map((c) => c.id).filter(Boolean);
      const saved = await apiJson("/api/containers/reorder", {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      });
      // backend returnt de nieuwe lijst
      if (Array.isArray(saved)) setContainers(saved);
    } catch (e) {
      // rollback als het misgaat
      setContainers(containers);
      throw e;
    }
  };

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
        loadingContainers,
        addContainer,
        deleteContainer,
        updateContainer,
        moveContainer, // ✅ nieuw
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
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
