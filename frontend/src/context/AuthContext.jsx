import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { toIndianE164 } from "@/lib/phone";

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
    } catch (err) {
      // Non-fatal — cached user is still usable. Log for debugging.
      console.warn("refreshMe failed:", err);
    }
  }, [token]);

  useEffect(() => {
    if (token) refreshMe();
  }, [token, refreshMe]);

  const sendOtp = async (phone, role = "customer") => {
    setLoading(true);
    try {
      // Normalize to 91-prefixed 12-digit so the deployed backend passes a
      // MSG91-valid number through — a 10-digit input causes silent MSG91 rejection.
      const { data } = await api.post("/auth/send-otp", { phone: toIndianE164(phone), role });
      return data;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (phone, otp, role = "customer", ref = null) => {
    setLoading(true);
    try {
      const body = {
        phone: toIndianE164(phone),
        otp,
        role,
        via_referral: !!ref,
      };
      if (ref) body.ref = ref;
      const { data } = await api.post("/auth/verify-otp", body);
      persist(data.token, data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const pinLogin = async (phone, pin, role = "customer") => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/pin-login", { phone: toIndianE164(phone), pin, role });
      persist(data.token, data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const loginEmail = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login-email", { email, password });
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
  const isCustomer = user?.role === "customer";
  const isAdmin = user?.role === "admin";
  const isReceptionist = user?.role === "receptionist";

  const contextValue = useMemo(
    () => ({
      user,
      token,
      loading,
      isProvider,
      isCustomer,
      isAdmin,
      isReceptionist,
      sendOtp,
      verifyOtp,
      pinLogin,
      loginEmail,
      setPin,
      logout,
      updateProfile,
      refreshMe,
    }),
    // sendOtp/verifyOtp/pinLogin/setPin/logout/updateProfile are stable across renders
    // (closed over setState which React guarantees is stable); only re-memo when user/token/loading change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, loading, refreshMe]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
