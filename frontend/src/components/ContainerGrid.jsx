// src/components/ContainerGrid.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSettings, getIconComponent } from "../context/SettingsContext.jsx";

const ContainerGrid = () => {
  const { containers } = useSettings();
  const [statusById, setStatusById] = useState({});

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const res = await fetch("/api/containers/status");
        const data = await res.json();

        if (!res.ok) {
          console.error("Status load error:", data);
          return;
        }

        if (!Array.isArray(data)) return;
        if (cancelled) return;

        const map = {};
        for (const item of data) {
          if (!item.id) continue;
          map[item.id] = {
            online: item.online,
            statusCode: item.statusCode,
            url: item.url,
          };
        }
        setStatusById(map);
      } catch (err) {
        console.error("Status load error:", err);
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!containers || containers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
    >
      {containers.map((container, idx) => {
        const Icon = getIconComponent(container.iconName);
        const gradient = container.color || "from-slate-600 to-slate-800";

        const status = statusById[container.id] || {};
        const online = status.online ?? true;

        const dotColor = online ? "bg-emerald-400" : "bg-red-400";
        const pingColor = online ? "bg-emerald-300" : "bg-red-300";

        // 🔧 URL fix: als er geen http(s) in staat, voeg http:// toe
        const rawHref = container.url || "#";
        const href =
          rawHref && !/^https?:\/\//i.test(rawHref)
            ? `http://${rawHref}`
            : rawHref;

        return (
          <a
            key={idx}
            href={href}
            target={href !== "#" ? "_blank" : undefined}
            rel={href !== "#" ? "noreferrer" : undefined}
            className="relative group select-none"
          >
            <div
              className="
                relative
                flex flex-col items-center justify-center
                rounded-2xl px-4 pt-4 pb-3
                bg-white/70 border border-slate-200
                dark:bg-slate-900/70 dark:border-slate-800
                shadow-md hover:shadow-xl hover:border-slate-600
                dark:hover:border-slate-600
                transition-all
              "
            >
              <div className="absolute top-2.5 right-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-70`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
                </span>
              </div>

              <div className="flex flex-col items-center justify-center text-center gap-2">
                <div
                  className={`
                    w-[72px] h-[72px]
                    rounded-2xl bg-gradient-to-br ${gradient}
                    flex items-center justify-center shadow-md
                  `}
                >
                  <Icon className="w-[40px] h-[40px] text-white" />
                </div>

                <p className="text-base font-semibold text-slate-100 leading-tight">
                  {container.name}
                </p>
              </div>
            </div>
          </a>
        );
      })}
    </motion.div>
  );
};

export default ContainerGrid;
