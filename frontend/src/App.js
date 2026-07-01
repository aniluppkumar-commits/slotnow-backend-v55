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

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === "provider" ? "/provider" : "/"} replace />;
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
                background: "#1E2A24",
                color: "#FDFBF7",
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

            {/* Customer routes */}
            <Route path="/" element={<RequireAuth><RequireRole role="customer"><Home /></RequireRole></RequireAuth>} />
            <Route path="/category/:id" element={<RequireAuth><RequireRole role="customer"><CategoryPage /></RequireRole></RequireAuth>} />
            <Route path="/provider/:id" element={<RequireAuth><RequireRole role="customer"><ProviderDetail /></RequireRole></RequireAuth>} />
            <Route path="/book/:providerId" element={<RequireAuth><RequireRole role="customer"><BookSlot /></RequireRole></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth><RequireRole role="customer"><MyBookings /></RequireRole></RequireAuth>} />
            <Route path="/bookings/:id" element={<RequireAuth><RequireRole role="customer"><BookingDetail /></RequireRole></RequireAuth>} />

            {/* Provider routes */}
            <Route path="/provider" element={<RequireAuth><RequireRole role="provider"><ProviderDashboard /></RequireRole></RequireAuth>} />
            <Route path="/provider/onboarding" element={<RequireAuth><RequireRole role="provider"><ProviderOnboarding /></RequireRole></RequireAuth>} />
            <Route path="/provider/services" element={<RequireAuth><RequireRole role="provider"><ProviderServices /></RequireRole></RequireAuth>} />
            <Route path="/provider/availability" element={<RequireAuth><RequireRole role="provider"><ProviderAvailability /></RequireRole></RequireAuth>} />
            <Route path="/provider/queue" element={<RequireAuth><RequireRole role="provider"><ProviderQueue /></RequireRole></RequireAuth>} />

            {/* Shared routes */}
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
