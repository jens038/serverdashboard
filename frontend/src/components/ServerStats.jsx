// src/components/ServerStats.jsx
import React, { useEffect, useState } from "react";
import StatCard from "@/components/StatCard";
import { Cpu, MemoryStick, Network, HardDrive } from "lucide-react";

const HISTORY_LENGTH = 30;

const makeHistory = (value) => Array(HISTORY_LENGTH).fill(value);

const ServerStats = () => {
  const [stats, setStats] = useState({
    cpu: { value: 0, history: makeHistory(0) },
    ram: { value: 0, history: makeHistory(0) },
    network: { value: 0, history: makeHistory(0) }, // MB/s
    storage: { value: 0, history: makeHistory(0) },
  });

  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/system/stats");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || `Status ${res.status}`);
        }

        if (cancelled) return;

        const cpuVal = Number(data.cpu?.percent ?? 0);
        const ramVal = Number(data.ram?.percent ?? 0);
        const storageVal = Number(data.storage?.percent ?? 0);

        const rx = data.network?.rxBytesPerSec ?? 0;
        const tx = data.network?.txBytesPerSec ?? 0;
        const totalBytesPerSec = rx + tx;
        const mbPerSec = totalBytesPerSec / (1024 * 1024);

        const updateHistory = (prev, nextVal) => {
          const val = isFinite(nextVal) ? Math.max(0, nextVal) : 0;
          const newHist = [...prev.history.slice(1), val];
          return { value: val, history: newHist };
        };

        setStats((prev) => ({
          cpu: updateHistory(prev.cpu, cpuVal),
          ram: updateHistory(prev.ram, ramVal),
          network: updateHistory(prev.network, mbPerSec),
          storage: updateHistory(prev.storage, storageVal),
        }));

        setError(null);
      } catch (e) {
        if (!cancelled) {
          console.error("Failed to load /api/system/stats:", e);
          setError(e.message);
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const statCards = [
    {
      icon: Cpu,
      label: "CPU",
      value: `${stats.cpu.value.toFixed(0)}%`,
      color: "from-blue-500 to-cyan-500",
      strokeColor: "#06b6d4",
      data: stats.cpu.history,
    },
    {
      icon: MemoryStick,
      label: "RAM",
      value: `${stats.ram.value.toFixed(0)}%`,
      color: "from-purple-500 to-pink-500",
      strokeColor: "#d946ef",
      data: stats.ram.history,
    },
    {
      icon: Network,
      label: "NETWORK",
      value: `${stats.network.value.toFixed(1)} MB/s`,
      color: "from-green-500 to-emerald-500",
      strokeColor: "#10b981",
      data: stats.network.history,
    },
    {
      icon: HardDrive,
      label: "STORAGE",
      value: `${stats.storage.value.toFixed(0)}%`,
      color: "from-indigo-500 to-violet-500",
      strokeColor: "#8b5cf6",
      data: stats.storage.history,
    },
  ];

  return (
    <section className="w-full mb-4">
      {error && (
        <p className="text-xs text-red-400 mb-2">
          Kon systeemstatistieken niet laden: {error}
        </p>
      )}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard key={stat.label} {...stat} index={index} />
        ))}
      </div>
    </section>
  );
};

export default ServerStats;
