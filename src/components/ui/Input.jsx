import React from 'react';

export function Input({
  label,
  error,
  type = 'text',
  className = '',
  id,
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={`w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none text-sm transition-all duration-200 dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 ${
          error ? 'border-rose-500 focus:ring-rose-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{error}</p>}
    </div>
  );
}
