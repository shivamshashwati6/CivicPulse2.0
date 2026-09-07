import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      onClick={toggleTheme}
      type="button"
      className={`relative p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex items-center justify-center ${className}`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label="Toggle Theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="dark-sun"
            initial={{ scale: 0, rotate: -90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 90, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'backOut' }}
            className="flex items-center justify-center text-amber-400"
          >
            <Sun className="w-5 h-5 drop-shadow-xs" />
          </motion.div>
        ) : (
          <motion.div
            key="light-moon"
            initial={{ scale: 0, rotate: 90, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: -90, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'backOut' }}
            className="flex items-center justify-center text-slate-700"
          >
            <Moon className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Micro-interaction Background Ripple */}
      <motion.span
        key={theme}
        initial={{ scale: 0, opacity: 0.4 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.45 }}
        className="absolute inset-0 bg-blue-500/20 rounded-2xl pointer-events-none"
      />
    </motion.button>
  );
}
