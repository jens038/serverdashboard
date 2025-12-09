import React, { useState, useEffect } from 'react';
import StatCard from '@/components/StatCard';
import { Cpu, MemoryStick, Network, HardDrive } from 'lucide-react'; 

const ServerStats = () => {
  const HISTORY_LENGTH = 20;
  
  const generateInitialData = (base, variance) => {
    return Array.from({ length: HISTORY_LENGTH }, () =>
      Math.max(0, Math.min(100, base + (Math.random() * variance * 2 - variance)))
    );
  };

  const [stats, setStats] = useState({
    cpu: { value: 25, history: generateInitialData(25, 10) },
    ram: { value: 55, history: generateInitialData(55, 5) },
    network: { value: 120, history: generateInitialData(40, 30) },
    storage: { value: 68, history: Array(HISTORY_LENGTH).fill(68) }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => {
        const updateMetric = (prevMetric, generateNextValue) => {
          const nextValue = generateNextValue(prevMetric.value);
          const graphValue =
            prevMetric === prev.network
              ? Math.min((nextValue / 1000) * 100, 100)
              : nextValue;

          const newHistory = [...prevMetric.history.slice(1), graphValue];
          return { value: nextValue, history: newHistory };
        };

        return {
          cpu: updateMetric(prev.cpu, () => Math.floor(Math.random() * 40) + 20),
          ram: updateMetric(prev.ram, () => Math.floor(Math.random() * 30) + 50),
          network: updateMetric(prev.network, () => Math.floor(Math.random() * 500) + 100),
          storage: prev.storage
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      icon: Cpu,
      label: 'CPU',
      value: `${stats.cpu.value}%`,
      color: 'from-blue-500 to-cyan-500',
      strokeColor: '#06b6d4',
      data: stats.cpu.history
    },
    {
      icon: MemoryStick,
      label: 'RAM',
      value: `${stats.ram.value}%`,
      color: 'from-purple-500 to-pink-500',
      strokeColor: '#d946ef',
      data: stats.ram.history
    },
    {
      icon: Network,
      label: 'NETWORK',
      value: `${stats.network.value} MB/s`,
      color: 'from-green-500 to-emerald-500',
      strokeColor: '#10b981',
      data: stats.network.history
    },
    {
      icon: HardDrive,
      label: 'STORAGE',
      value: `${stats.storage.value}%`,
      color: 'from-indigo-500 to-violet-500',
      strokeColor: '#8b5cf6',
      data: stats.storage.history
    }
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
