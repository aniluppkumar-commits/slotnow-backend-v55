import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RequireAuth({ children }) {
  const { user, token } = useAuth();
  const location = useLocation();
  if (!user || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
