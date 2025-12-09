import React from 'react';
import { motion } from 'framer-motion';

const SimpleSparkline = ({ data, color, idSuffix }) => {
  const height = 40;
  const width = 120;

  if (!data || data.length === 0) return null;

  const max = 100;
  const min = 0;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / (max - min)) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const gradientId = `sparkline-gradient-${idSuffix}`;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area */}
      <motion.path
        d={`M 0,${height} L ${points} L ${width},${height} Z`}
        fill={`url(#${gradientId})`}
        stroke="none"
        initial={false}
        animate={{ d: `M 0,${height} L ${points} L ${width},${height} Z` }}
        transition={{ duration: 0.5, ease: 'linear' }}
      />

      {/* Line */}
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ points }}
        transition={{ duration: 0.5, ease: 'linear' }}
      />
    </svg>
  );
};

const StatCard = ({ icon: Icon, label, value, color, strokeColor, data, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className="
        relative
        bg-white dark:bg-slate-800/60 backdrop-blur-sm
        border border-slate-200 dark:border-slate-700/50
        rounded-xl p-4 shadow-sm hover:shadow-md
        transition-all overflow-hidden
        flex flex-col justify-between
        min-h-[150px]
      "
    >
      <div className="relative z-10 flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </p>
          <motion.span
            className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight"
            key={value}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
          >
            {value}
          </motion.span>
        </div>
        <div className={`p-2 bg-gradient-to-br ${color} rounded-lg shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="relative mt-2 h-12">
        <SimpleSparkline data={data} color={strokeColor} idSuffix={label} />
      </div>
    </motion.div>
  );
};

export default StatCard;
