import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Film, Tv, Play, Music, Video, Radio, Headphones, Cast, Image, Camera, Gamepad, Speaker,
  Database, HardDrive, File, Folder, Archive, Save, Cloud, Upload, Download,
  Server, Wifi, Globe, Shield, Lock, Lock as LockOpen, Key, Link, Terminal, Code,
  Activity, Cpu, Monitor, Zap, Settings, Wrench, RefreshCw, Trash,
  PieChart, BarChart, LineChart, Table, Eye,
  Box, Star, Home, User, Mail, Calendar, Clock, Smartphone,
  Package, Layers, Layout, GitBranch,
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

export const SettingsProvider = ({ children }) => {
  const [containers, setContainers] = useState(() => {
    const saved = localStorage.getItem("docker-containers");
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  });

  const [dialogState, setDialogState] = useState({
    isOpen: false,
    mode: "new", // 'new' | 'manage' | 'edit'
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

  const moveContainer = (fromIndex, toIndex) =>
    setContainers((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const arr = [...prev];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return arr;
    });

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
        moveContainer,
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
