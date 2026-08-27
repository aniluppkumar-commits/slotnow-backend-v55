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
    // Normalize FastAPI Pydantic v2 validation-error payloads so callers can
    // safely render `err.response.data.detail` as a string in toast/alerts.
    // Raw shape from FastAPI 422 is: { detail: [{ type, loc, msg, input, url }, ...] }
    // which was leaking straight into React children ("Objects are not valid as
    // a React child …"). We flatten it to a human-readable one-liner while
    // keeping the raw array available at `.detail_raw` for anyone who needs it.
    const data = err.response?.data;
    if (data && data.detail && typeof data.detail !== "string") {
      const d = data.detail;
      data.detail_raw = d;
      if (Array.isArray(d)) {
        data.detail = d
          .map((e) => {
            const field = Array.isArray(e?.loc)
              ? e.loc.filter((p) => p !== "body").join(".")
              : "";
            const msg = e?.msg || e?.message || "Invalid value";
            return field ? `${field}: ${msg}` : msg;
          })
          .join("; ");
      } else if (typeof d === "object") {
        data.detail = d.msg || d.message || JSON.stringify(d);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
