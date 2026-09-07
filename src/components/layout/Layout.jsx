import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] dark:bg-[#080d1a] text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-300 light-canvas-bg dark:cyber-tactical-bg relative">
      <Navbar />
      <main className="flex-grow w-full z-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
