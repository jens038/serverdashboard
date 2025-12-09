import React from 'react';
import { motion } from 'framer-motion';
import { useSettings } from "../context/SettingsContext.jsx";

const ContainerCard = ({
  name,
  description,
  icon: Icon,
  status,
  color,
  url,
  index
}) => {
  const { openEditDialog } = useSettings();

  const handleClick = () => {
    openEditDialog(index);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="
        cursor-pointer
        bg-white dark:bg-slate-800/50 backdrop-blur-sm
        border border-slate-200 dark:border-slate-700/50
        rounded-2xl shadow-sm hover:shadow-xl
        transition-all group
        flex flex-col items-center justify-center
        text-center relative overflow-hidden
        p-5
        min-h-[150px]
      "
    >
      {/* Glow Background */}
      <div
        className={`
          absolute -top-10 -right-10 
          w-24 h-24 
          bg-gradient-to-br ${color}
          rounded-full blur-3xl 
          opacity-10 group-hover:opacity-20 
          transition-opacity
        `}
      />

      {/* Icon */}
      <div
        className={`
          p-4 rounded-2xl
          bg-gradient-to-br ${color}
          shadow-lg shadow-slate-200 dark:shadow-none
          group-hover:scale-110 transition-transform duration-300
          flex items-center justify-center
        `}
      >
        <Icon className="w-12 h-12 text-white" />
      </div>

      {/* Title */}
      <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">
        {name}
      </h3>

      {/* Status Dot */}
      <span
        className={`
          absolute top-3 right-3 w-2.5 h-2.5 rounded-full 
          ${
            status === 'running'
              ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'
              : 'bg-red-500'
          }
        `}
      />
    </motion.div>
  );
};

export default ContainerCard;
