import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, type Role } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { CartPage } from './pages/CartPage';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { MedicationDetailPage } from './pages/MedicationDetailPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { PharmacyPage } from './pages/PharmacyPage';

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/medications/:id" element={<MedicationDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/cart"
          element={
            <RequireRole roles={['PATIENT']}>
              <CartPage />
            </RequireRole>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireRole roles={['PATIENT']}>
              <MyOrdersPage />
            </RequireRole>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireRole roles={['PATIENT', 'PHARMACIST']}>
              <OrderDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/farmacia"
          element={
            <RequireRole roles={['PHARMACIST']}>
              <PharmacyPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
