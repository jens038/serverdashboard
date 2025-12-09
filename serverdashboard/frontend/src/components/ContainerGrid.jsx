import React from "react";
import { motion } from "framer-motion";
import { useSettings, getIconComponent } from "../context/SettingsContext.jsx";

const ContainerGrid = () => {
  const { containers } = useSettings();
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

        return (
          <a
            key={idx}
            href={container.url || "#"}
            target={container.url ? "_blank" : undefined}
            rel={container.url ? "noreferrer" : undefined}
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
              {/* status-dot */}
              <div className="absolute top-2.5 right-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-70" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
              </div>

              {/* content */}
              <div className="flex flex-col items-center justify-center text-center gap-2">
                {/* groot icoon, maar altijd binnen de tile */}
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
