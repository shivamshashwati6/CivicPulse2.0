import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white/80 border border-slate-200/80 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] rounded-2xl dark:bg-slate-900/60 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-blue-500/40 hover:dark:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 text-slate-900 dark:text-slate-100 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`text-lg font-bold text-slate-900 dark:text-white tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`${className}`} {...props}>
      {children}
    </div>
  );
}
