import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("slotnow_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("slotnow_token"));
  const [loading, setLoading] = useState(false);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/users/me");
      setUser(data);
      localStorage.setItem("slotnow_user", JSON.stringify(data));
    } catch (e) {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (token) refreshMe();
  }, [token, refreshMe]);

  const sendOtp = async (phone, role = "customer") => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/send-otp", { phone, role });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (phone, otp, role = "customer") => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-otp", {
        phone,
        otp,
        role,
        via_referral: false,
      });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("slotnow_token", data.token);
      localStorage.setItem("slotnow_user", JSON.stringify(data.user));
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("slotnow_token");
    localStorage.removeItem("slotnow_user");
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (patch) => {
    const { data } = await api.put("/users/me", patch);
    setUser(data);
    localStorage.setItem("slotnow_user", JSON.stringify(data));
    return data;
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, sendOtp, verifyOtp, logout, updateProfile, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
