import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL;

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("slotnow_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("slotnow_token");
      localStorage.removeItem("slotnow_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
