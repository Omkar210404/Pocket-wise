import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AuthLayout } from '@/auth/AuthLayout';
import { LoginPage, RegisterPage } from '@/auth/AuthPages';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { AppLayout } from '@/layout/AppLayout';
import { NotFoundPage } from '@/layout/NotFoundPage';

// Each page is its own chunk, so the charting library loads only with the dashboard.
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage'));
const BudgetsPage = lazy(() => import('@/features/budgets/BudgetsPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
