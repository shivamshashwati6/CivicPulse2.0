import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Menu, X, PlusCircle, LogOut, LayoutDashboard, User, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../common/ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout, adminLogout } = useAuth();
  const toast = useToast();

  const currentPath = location.pathname;
  const isLandingPage = currentPath === '/';

  // Strict Role & View Isolation
  const isAdminView = currentPath.startsWith('/admin') || isAdmin === true;
  const isAuthenticated = Boolean(user && user.id) || isAdmin === true;
  const isCitizen = isAuthenticated && !isAdminView;

  const displayName = isAdminView
    ? (user?.email || user?.user_metadata?.full_name || 'Municipal Admin')
    : (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Citizen User');

  const toggleMenu = () => setIsOpen(!isOpen);

  // Synchronized Unified Logout Handler
  const handleLogout = async () => {
    setIsOpen(false);
    if (isAdmin || currentPath.startsWith('/admin')) {
      adminLogout();
    }
    if (user) {
      await logout();
    }
    toast.success('Logged out successfully.');
    navigate('/');
  };

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Contact', href: '#contact' },
  ];

  const handleNavClick = (href) => {
    setIsOpen(false);
    if (href.startsWith('#')) {
      if (currentPath !== '/') {
        window.location.href = '/' + href;
        return;
      }
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8">
      {/* Floating Pill Glass Header */}
      <div className="max-w-7xl mx-auto px-6 py-3 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group hover:scale-[1.02] transition-transform">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-colors">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-300 dark:bg-clip-text dark:text-transparent">
              Civic<span className="text-blue-600 dark:text-blue-400">Pulse</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={(e) => {
                  if (item.href.startsWith('#')) {
                    e.preventDefault();
                    handleNavClick(item.href);
                  }
                }}
                className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                {item.name}
              </a>
            ))}
            
            {/* Citizen Only: 'Dashboard' Link */}
            {isCitizen && !isLandingPage && (
              <Link
                to="/dashboard"
                className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            )}

            {/* Admin Only: 'Admin Portal' Active Badge */}
            {isAdminView && (
              <Link
                to="/admin"
                className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-100 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-[#1e293b]/60 rounded-full border border-slate-200/80 dark:border-slate-700/60"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Admin Portal
              </Link>
            )}
          </nav>

          {/* Desktop Action Buttons with Theme Toggle */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />

            {isAdminView ? (
              /* ADMIN VIEW */
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 dark:bg-[#1e293b]/80 border border-slate-800 dark:border-slate-700/80 text-xs font-bold text-white shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span className="max-w-[140px] truncate">{displayName}</span>
                  <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                    Admin
                  </span>
                </div>

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#1e293b]/80 hover:text-rose-600 font-medium rounded-full"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                  Logout
                </Button>
              </div>
            ) : isAuthenticated ? (
              /* CITIZEN LOGGED IN VIEW */
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#1e293b]/80 border border-slate-200 dark:border-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="max-w-[140px] truncate">{displayName}</span>
                  <span className="ml-1 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Citizen
                  </span>
                </div>

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#1e293b]/80 hover:text-rose-600 font-medium rounded-full"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1 text-slate-500 dark:text-slate-400" />
                  Logout
                </Button>

                <Link to="/report">
                  <Button size="sm" className="rounded-full">
                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                    Report Issue
                  </Button>
                </Link>
              </div>
            ) : (
              /* UNAUTHENTICATED LOGGED OUT VIEW */
              <div className="flex items-center gap-2.5">
                <Link to="/login">
                  <Button variant="outline" size="sm" className="rounded-full text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700">
                    <User className="w-3.5 h-3.5 mr-1.5 text-slate-500 dark:text-slate-400" />
                    Login
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="sm" className="rounded-full">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={toggleMenu}
              type="button"
              className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
              aria-label="Toggle Navigation"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden mt-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0f172a]/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3 shadow-xl">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              onClick={(e) => {
                if (item.href.startsWith('#')) {
                  e.preventDefault();
                  handleNavClick(item.href);
                } else {
                  setIsOpen(false);
                }
              }}
              className="block px-3 py-2 text-base font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl"
            >
              {item.name}
            </a>
          ))}

          {isCitizen && !isLandingPage && (
            <Link
              to="/dashboard"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-base font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl"
            >
              Dashboard
            </Link>
          )}

          {isAdminView && (
            <Link
              to="/admin"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-base font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Admin Portal
            </Link>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
            {isAdminView ? (
              <>
                <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex items-center justify-between">
                  <span>Logged in as <strong className="text-slate-800 dark:text-white">{displayName}</strong></span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                    Admin
                  </span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full justify-center text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <LogOut className="w-4 h-4 mr-2 text-rose-500" />
                  Logout
                </Button>
              </>
            ) : isAuthenticated ? (
              <>
                <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex items-center justify-between">
                  <span>Logged in as <strong className="text-slate-800 dark:text-white">{displayName}</strong></span>
                  <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Citizen
                  </span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full justify-center text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <LogOut className="w-4 h-4 mr-2 text-rose-500" />
                  Logout
                </Button>
                <Link to="/report" onClick={() => setIsOpen(false)}>
                  <Button className="w-full justify-center bg-blue-600 text-white hover:bg-blue-700 font-semibold rounded-xl">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Report Issue
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link to="/login" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full justify-center text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-xl">
                    <User className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
                    Login
                  </Button>
                </Link>
                <Link to="/login" onClick={() => setIsOpen(false)}>
                  <Button className="w-full justify-center bg-blue-600 text-white hover:bg-blue-700 font-semibold rounded-xl">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
