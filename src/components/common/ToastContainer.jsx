import React from 'react';
import { useToast } from '../../hooks/useToast';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts || toasts.length === 0) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-emerald-50/90 text-emerald-900',
    error: 'border-rose-200 bg-rose-50/90 text-rose-900',
    info: 'border-blue-200 bg-blue-50/90 text-blue-900',
    warning: 'border-amber-200 bg-amber-50/90 text-amber-900',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in fade-in slide-in-from-bottom-5 ${
            borders[toast.type] || borders.info
          }`}
        >
          <div className="flex items-start gap-3">
            {icons[toast.type] || icons.info}
            <p className="text-sm font-medium leading-tight pt-0.5">{toast.message}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-700 transition-colors p-0.5 rounded-lg focus:outline-none"
            aria-label="Dismiss toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
