import React from 'react';
import { Camera, MapPin, Sparkles, ShieldCheck } from 'lucide-react';

export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[320px] sm:max-w-[340px]">
      {/* Outer Phone Frame */}
      <div className="relative rounded-3xl bg-gray-900 p-3 shadow-xl border border-slate-200 dark:border-slate-800">
        
        {/* Notch / Speaker Bar */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-36 bg-gray-900 rounded-b-2xl z-20 flex items-center justify-center">
          <div className="w-12 h-1.5 bg-gray-800 rounded-full" />
        </div>

        {/* Screen Content */}
        <div className="relative rounded-2xl bg-white overflow-hidden border border-gray-100 font-sans text-xs text-gray-900 pt-6 pb-4 px-3.5 space-y-3">
          
          {/* App Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">
                CP
              </div>
              <span className="font-bold text-gray-900 text-xs">CivicPulse</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-[10px] border border-emerald-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live System
            </span>
          </div>

          {/* Photo Capture Card Preview */}
          <div className="relative rounded-xl overflow-hidden bg-gray-900 text-white p-3 space-y-2 border border-gray-800 shadow-xs">
            <div className="h-32 rounded-lg bg-gradient-to-br from-slate-800 via-slate-700 to-blue-900 relative flex items-center justify-center overflow-hidden">
              {/* Simulated camera grid & pothole icon */}
              <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:12px_12px] opacity-20" />
              <div className="text-center space-y-1 relative z-10">
                <div className="w-9 h-9 rounded-full bg-blue-600/80 backdrop-blur-xs mx-auto flex items-center justify-center text-white border border-blue-400/40">
                  <Camera className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-blue-200 font-medium">Image Captured</p>
              </div>

              {/* AI Detection Overlay Pill */}
              <div className="absolute bottom-2 left-2 right-2 bg-gray-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-blue-500/30 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1 text-blue-300 font-semibold">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  Gemini AI Vision
                </div>
                <span className="text-emerald-400 font-mono font-bold">98.4% Match</span>
              </div>
            </div>

            {/* Classification Metadata */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">Road Hazard / Pothole</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold text-[9px] border border-rose-500/30">
                  High Severity
                </span>
              </div>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0" />
                342 Main Street, Sector 4
              </p>
            </div>
          </div>

          {/* AI Routing Box (Glassmorphism highlight) */}
          <div className="p-2.5 rounded-xl bg-blue-50/80 backdrop-blur-xs border border-blue-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-900 text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Automated Smart Routing
              </span>
              <span className="text-[9px] text-blue-600 font-medium">Instant</span>
            </div>
            <p className="text-[10px] text-blue-700 leading-tight">
              Routed to <strong className="text-blue-900">Public Works & Roads Dept</strong> (Ticket #CP-8924)
            </p>
          </div>

          {/* Status Timeline Snippet */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
              <span>Resolution Progress</span>
              <span className="text-blue-600 font-bold">Step 3 of 4</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-3/4 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Glow */}
      <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-blue-500/15 rounded-full blur-2xl -z-10 pointer-events-none" />
    </div>
  );
}
