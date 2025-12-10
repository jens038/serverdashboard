// src/components/ServerStats.jsx
import React, { useState, useEffect } from 'react';
import StatCard from '@/components/StatCard';
import { Cpu, MemoryStick, Network, HardDrive } from 'lucide-react';

const HISTORY_LENGTH = 20;

const emptyHistory = Array(HISTORY_LENGTH).fill(0);

const ServerStats = () => {
  const [stats, setStats] = useState({
    cpu: { value: 0, history: emptyHistory },
    ram: { value: 0, history: emptyHistory },
    network: { value: 0, history: emptyHistory },
    storage: { value: 0, history: emptyHistory },
  });

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/system/stats');
        const data = await res.json();

        if (!res.ok) {
          console.error('Failed to load system stats:', data);
          return;
        }

        const cpuVal = Math.round(data.cpu?.usagePercent ?? 0);
        const ramVal = Math.round(data.ram?.usagePercent ?? 0);
        const netVal = Math.max(0, data.network?.mbps ?? 0);   // MB/s
        const storageVal = Math.round(data.storage?.usagePercent ?? 0);

        // Netwerk voor de grafiek schalen naar 0–100 (bijv. 0–1000 MB/s → 0–100%)
        const netGraphVal = Math.min((netVal / 1000) * 100, 100);

        if (cancelled) return;

        setStats(prev => ({
          cpu: {
            value: cpuVal,
            history: [...prev.cpu.history.slice(1), cpuVal],
          },
          ram: {
            value: ramVal,
            history: [...prev.ram.history.slice(1), ramVal],
          },
          network: {
            value: netVal,
            history: [...prev.network.history.slice(1), netGraphVal],
          },
          storage: {
            value: storageVal,
            history: [...prev.storage.history.slice(1), storageVal],
          },
        }));
      } catch (err) {
        console.error('Error fetching system stats:', err);
      }
    };

    // direct eerste load
    fetchStats();
    // daarna elke 3 seconden
    const interval = setInterval(fetchStats, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const statCards = [
    {
      icon: Cpu,
      label: 'CPU',
      value: `${stats.cpu.value}%`,
      color: 'from-blue-500 to-cyan-500',
      strokeColor: '#06b6d4',
      data: stats.cpu.history,
    },
    {
      icon: MemoryStick,
      label: 'RAM',
      value: `${stats.ram.value}%`,
      color: 'from-purple-500 to-pink-500',
      strokeColor: '#d946ef',
      data: stats.ram.history,
    },
    {
      icon: Network,
      label: 'NETWORK',
      value: `${stats.network.value.toFixed(1)} MB/s`,
      color: 'from-green-500 to-emerald-500',
      strokeColor: '#10b981',
      data: stats.network.history,
    },
    {
      icon: HardDrive,
      label: 'STORAGE',
      value: `${stats.storage.value}%`,
      color: 'from-indigo-500 to-violet-500',
      strokeColor: '#8b5cf6',
      data: stats.storage.history,
    },
  ];

  return (
    <section className="w-full mb-4">
      <div
        className="
          grid gap-3
          grid-cols-2
          lg:grid-cols-4
        "
      >
        {statCards.map((stat, index) => (
          <StatCard key={stat.label} {...stat} index={index} />
        ))}
      </div>
    </section>
  );
};

export default ServerStats;
