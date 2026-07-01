import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/category/:id"
            element={
              <RequireAuth>
                <CategoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/provider/:id"
            element={
              <RequireAuth>
                <ProviderDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/book/:providerId"
            element={
              <RequireAuth>
                <BookSlot />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <MyBookings />
              </RequireAuth>
            }
          />
          <Route
            path="/bookings/:id"
            element={
              <RequireAuth>
                <BookingDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <Notifications />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
