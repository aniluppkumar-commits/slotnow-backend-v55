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

  const persist = (tok, usr) => {
    if (tok) localStorage.setItem("slotnow_token", tok);
    if (usr) localStorage.setItem("slotnow_user", JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
  };

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
      persist(data.token, data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const pinLogin = async (phone, pin, role = "customer") => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/pin-login", { phone, pin, role });
      persist(data.token, data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const setPin = async (pin) => {
    const { data } = await api.post("/auth/set-pin", { pin });
    await refreshMe();
    return data;
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

  const isProvider = user?.role === "provider";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isProvider,
        sendOtp,
        verifyOtp,
        pinLogin,
        setPin,
        logout,
        updateProfile,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
