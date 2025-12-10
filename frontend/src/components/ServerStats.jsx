import React, { useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import { Cpu, MemoryStick, Network, HardDrive } from "lucide-react";

const HISTORY_LENGTH = 30;

const makeHistory = (initialValue = 0) =>
  Array(HISTORY_LENGTH).fill(initialValue);

const ServerStats = () => {
  const [stats, setStats] = useState({
    cpu: { value: 0, history: makeHistory(0) },
    ram: { value: 0, history: makeHistory(0) },
    network: { value: 0, history: makeHistory(0) }, // MB/s
    storage: { value: 0, history: makeHistory(0) },
  });

  // Eén helper om een metric + history bij te werken
  const updateMetric = (prevMetric, nextValue) => {
    const value = Number.isFinite(nextValue) ? nextValue : 0;
    const newHistory = [...prevMetric.history.slice(1), value];
    return { value, history: newHistory };
  };

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch("/api/system/stats");
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("system stats error:", res.status, text);
          return;
        }

        const data = await res.json();

        const cpuVal = Math.round(data?.cpu?.usage ?? 0);
        const ramVal = Math.round(data?.memory?.usedPct ?? 0);
        const storageVal = Math.round(data?.storage?.usedPct ?? 0);
        const netVal = Number(
          (data?.network?.mbps ?? 0).toFixed
            ? data.network.mbps.toFixed(1)
            : data?.network?.mbps ?? 0
        );

        if (cancelled) return;

        setStats((prev) => ({
          cpu: updateMetric(prev.cpu, cpuVal),
          ram: updateMetric(prev.ram, ramVal),
          network: updateMetric(prev.network, netVal),
          storage: updateMetric(prev.storage, storageVal),
        }));
      } catch (err) {
        console.error("system stats fetch failed:", err);
      }
    };

    // direct 1x ophalen en daarna poll
    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const statCards = [
    {
      icon: Cpu,
      label: "CPU",
      value: `${stats.cpu.value}%`,
      color: "from-blue-500 to-cyan-500",
      strokeColor: "#06b6d4",
      data: stats.cpu.history,
    },
    {
      icon: MemoryStick,
      label: "RAM",
      value: `${stats.ram.value}%`,
      color: "from-purple-500 to-pink-500",
      strokeColor: "#d946ef",
      data: stats.ram.history,
    },
    {
      icon: Network,
      label: "NETWORK",
      value: `${stats.network.value.toFixed
        ? stats.network.value.toFixed(1)
        : stats.network.value
      } MB/s`,
      color: "from-green-500 to-emerald-500",
      strokeColor: "#10b981",
      data: stats.network.history,
    },
    {
      icon: HardDrive,
      label: "STORAGE",
      value: `${stats.storage.value}%`,
      color: "from-indigo-500 to-violet-500",
      strokeColor: "#8b5cf6",
      data: stats.storage.history,
    },
  ];

  return (
    <section className="w-full mb-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <StatCard key={stat.label} {...stat} index={index} />
        ))}
      </div>
    </section>
  );
};

export default ServerStats;
