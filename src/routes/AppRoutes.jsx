import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';

import { LandingPage } from '../pages/Landing/LandingPage';
import { LoginPage } from '../pages/Login/LoginPage';
import { AdminLoginPage } from '../pages/AdminLogin/AdminLoginPage';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { ReportPage } from '../pages/Report/ReportPage';
import { TrackPage } from '../pages/Track/TrackPage';
import { AdminPage } from '../pages/Admin/AdminPage';

import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';
import { AdminRoute } from './AdminRoute';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Public Routes */}
        <Route index element={<LandingPage />} />
        <Route path="track" element={<TrackPage />} />
        <Route path="admin/login" element={<AdminLoginPage />} />

        {/* Guest Only Routes (Redirects to Dashboard if authenticated) */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
        </Route>

        {/* Citizen Protected Routes (Redirects to Login if guest) */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="report" element={<ReportPage />} />
        </Route>

        {/* Municipal Admin Protected Routes (Redirects to Admin Login if not admin) */}
        <Route element={<AdminRoute />}>
          <Route path="admin" element={<AdminPage />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<LandingPage />} />
      </Route>
    </Routes>
  );
}
