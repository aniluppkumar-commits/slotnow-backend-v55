import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { I18nProvider } from "@/i18n";
import RequireAuth from "@/components/RequireAuth";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import CategoryPage from "@/pages/CategoryPage";
import ProviderDetail from "@/pages/ProviderDetail";
import BookSlot from "@/pages/BookSlot";
import MyBookings from "@/pages/MyBookings";
import BookingDetail from "@/pages/BookingDetail";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import ProviderOnboarding from "@/pages/provider/ProviderOnboarding";
import ProviderDashboard from "@/pages/provider/ProviderDashboard";
import ProviderServices from "@/pages/provider/ProviderServices";
import ProviderAvailability from "@/pages/provider/ProviderAvailability";
import ProviderQueue from "@/pages/provider/ProviderQueue";
import ProviderAssistants from "@/pages/provider/ProviderAssistants";
import ReceptionistDashboard from "@/pages/receptionist/ReceptionistDashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminRevenue from "@/pages/admin/AdminRevenue";

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) {
    const home =
      user.role === "provider"
        ? "/provider"
        : user.role === "admin"
        ? "/admin"
        : user.role === "receptionist"
        ? "/receptionist"
        : "/";
    return <Navigate to={home} replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "#1D2E5B",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "12px",
                fontFamily: "Manrope, sans-serif",
                fontSize: "14px",
                fontWeight: 600,
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Customer */}
            <Route path="/" element={<RequireAuth><RequireRole roles="customer"><Home /></RequireRole></RequireAuth>} />
            <Route path="/category/:id" element={<RequireAuth><RequireRole roles="customer"><CategoryPage /></RequireRole></RequireAuth>} />
            <Route path="/provider/:id" element={<RequireAuth><RequireRole roles="customer"><ProviderDetail /></RequireRole></RequireAuth>} />
            <Route path="/book/:providerId" element={<RequireAuth><RequireRole roles="customer"><BookSlot /></RequireRole></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth><RequireRole roles="customer"><MyBookings /></RequireRole></RequireAuth>} />
            <Route path="/bookings/:id" element={<RequireAuth><RequireRole roles="customer"><BookingDetail /></RequireRole></RequireAuth>} />

            {/* Provider */}
            <Route path="/provider" element={<RequireAuth><RequireRole roles="provider"><ProviderDashboard /></RequireRole></RequireAuth>} />
            <Route path="/provider/onboarding" element={<RequireAuth><RequireRole roles="provider"><ProviderOnboarding /></RequireRole></RequireAuth>} />
            <Route path="/provider/services" element={<RequireAuth><RequireRole roles="provider"><ProviderServices /></RequireRole></RequireAuth>} />
            <Route path="/provider/availability" element={<RequireAuth><RequireRole roles="provider"><ProviderAvailability /></RequireRole></RequireAuth>} />
            <Route path="/provider/queue" element={<RequireAuth><RequireRole roles="provider"><ProviderQueue /></RequireRole></RequireAuth>} />
            <Route path="/provider/assistants" element={<RequireAuth><RequireRole roles="provider"><ProviderAssistants /></RequireRole></RequireAuth>} />

            {/* Receptionist */}
            <Route path="/receptionist" element={<RequireAuth><RequireRole roles="receptionist"><ReceptionistDashboard /></RequireRole></RequireAuth>} />

            {/* Admin */}
            <Route path="/admin" element={<RequireAuth><RequireRole roles="admin"><AdminDashboard /></RequireRole></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth><RequireRole roles="admin"><AdminUsers /></RequireRole></RequireAuth>} />
            <Route path="/admin/bookings" element={<RequireAuth><RequireRole roles="admin"><AdminBookings /></RequireRole></RequireAuth>} />
            <Route path="/admin/settings/:kind" element={<RequireAuth><RequireRole roles="admin"><AdminSettings /></RequireRole></RequireAuth>} />
            <Route path="/admin/revenue" element={<RequireAuth><RequireRole roles="admin"><AdminRevenue /></RequireRole></RequireAuth>} />

            {/* Shared */}
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
