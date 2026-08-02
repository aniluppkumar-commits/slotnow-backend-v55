import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Stethoscope, Building2, Plus, X, Trash2, Loader2, MapPin, CalendarClock } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { compressImageToDataURL } from "@/lib/image";

/**
 * Hospital-only management screen: add doctors and diagnostic service centers
 * under this hospital's umbrella.
 */
export default function HospitalStaff() {
  const navigate = useNavigate();
  const [reference, setReference] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalKind, setModalKind] = useState(null); // "doctor" | "service" | null
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/providers/me/staff")
      .then((r) => setStaff(r.data || []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get("/reference/healthcare").then((r) => setReference(r.data)).catch(() => {});
    load();
  }, []);

  const openAdd = (kind) => {
    setModalKind(kind);
    setForm({
      kind,
      name: "",
      specialization: "",
      service_tags: [],
      photo: "",
      address: "",
      latitude: null,
      longitude: null,
    });
  };

  const closeModal = () => {
    if (saving) return;
    setModalKind(null);
    setForm({});
  };

  const useLocation = () => {
    if (!navigator.geolocation) return toast.error("Location not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude })),
      () => toast.error("Could not get location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = await compressImageToDataURL(f, { maxDim: 800, quality: 0.72 });
      setForm((prev) => ({ ...prev, photo: data }));
    } catch {
      toast.error("Could not upload photo");
    }
  };

  const submit = async () => {
    if (!form.name?.trim()) return toast.error("Name is required");
    if (form.kind === "doctor" && !form.specialization?.trim()) {
      return toast.error("Please select or type specialization");
    }
    if (form.kind === "service" && (!form.service_tags || form.service_tags.length === 0)) {
      return toast.error("Please select at least one service");
    }
    setSaving(true);
    try {
      // Strip UI-only helper field before hitting the API
      const { specialization_choice, ...payload } = form;
      await api.post("/providers/me/staff", payload);
      toast.success(form.kind === "doctor" ? "Doctor added" : "Service center added");
      closeModal();
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this entry?")) return;
    try {
      await api.delete(`/providers/me/staff/${id}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const doctors = staff.filter((s) => s.kind === "doctor");
  const services = staff.filter((s) => s.kind === "service");

  return (
    <AppShell title="Hospital Staff">
      <div className="px-4 sm:px-6 py-4 space-y-6">
        {/* Doctors */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-forest" />
              <h2 className="font-heading font-black text-lg">Doctors</h2>
              <span className="text-xs text-ink-muted">({doctors.length})</span>
            </div>
            <button
              onClick={() => openAdd("doctor")}
              data-testid="add-doctor-btn"
              className="inline-flex items-center gap-1 bg-forest text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-forest-dark"
            >
              <Plus size={13} /> Add doctor
            </button>
          </div>
          {loading ? (
            <div className="text-center py-8 text-ink-muted"><Loader2 className="animate-spin mx-auto" /></div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-8 text-ink-muted text-sm bg-white rounded-2xl border border-cream-300">
              No doctors yet. Add your first doctor.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {doctors.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl border border-cream-300 p-4 flex gap-3">
                  {d.photo ? (
                    <img src={d.photo} alt="" className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-cream flex items-center justify-center text-ink-muted">
                      <Stethoscope size={20} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink truncate">{d.name}</p>
                    {d.specialization && (
                      <p className="text-xs text-forest font-semibold">{d.specialization}</p>
                    )}
                    <button
                      data-testid={`staff-schedule-${d.id}`}
                      onClick={() => navigate(`/provider/staff/${d.id}/schedule`)}
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-forest hover:text-forest-dark"
                    >
                      <CalendarClock size={12} /> Schedule
                    </button>
                  </div>
                  <button
                    onClick={() => remove(d.id)}
                    className="text-red-500 hover:text-red-700 self-start"
                    aria-label="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Services */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-accent" />
              <h2 className="font-heading font-black text-lg">Other Services</h2>
              <span className="text-xs text-ink-muted">({services.length})</span>
            </div>
            <button
              onClick={() => openAdd("service")}
              data-testid="add-service-btn"
              className="inline-flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-accent-dark"
            >
              <Plus size={13} /> Add service
            </button>
          </div>
          {services.length === 0 ? (
            <div className="text-center py-8 text-ink-muted text-sm bg-white rounded-2xl border border-cream-300">
              No service centers yet. Add X-ray, Pathology, USG etc.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {services.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-cream-300 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold text-ink">{s.name}</p>
                    <button onClick={() => remove(s.id)} className="text-red-500 hover:text-red-700" aria-label="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {s.service_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {s.service_tags.map((t) => (
                        <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream text-ink-soft">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.address && <p className="text-xs text-ink-soft">{s.address}</p>}
                  <button
                    data-testid={`staff-schedule-${s.id}`}
                    onClick={() => navigate(`/provider/staff/${s.id}/schedule`)}
                    className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-accent hover:text-accent-dark"
                  >
                    <CalendarClock size={12} /> Schedule
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add modal */}
      {modalKind && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-auto animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-heading text-lg font-black text-ink">
                Add {modalKind === "doctor" ? "doctor" : "service center"}
              </h3>
              <button onClick={closeModal} className="text-ink-muted hover:text-ink" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                  {modalKind === "doctor" ? "Doctor's name" : "Center name"}
                </label>
                <input
                  data-testid="staff-name"
                  value={form.name || ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
                  placeholder={modalKind === "doctor" ? "Dr. Rahul Sharma" : "SlotNow Diagnostics"}
                />
              </div>
              {modalKind === "doctor" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                    Specialization
                  </label>
                  <select
                    data-testid="staff-spec"
                    value={form.specialization_choice ?? (
                      form.specialization && !(reference?.specializations || []).includes(form.specialization)
                        ? "__other__"
                        : (form.specialization || "")
                    )}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__other__") {
                        setForm({ ...form, specialization_choice: "__other__", specialization: form.specialization && !(reference?.specializations || []).includes(form.specialization) ? form.specialization : "" });
                      } else {
                        setForm({ ...form, specialization_choice: v, specialization: v });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
                  >
                    <option value="">— Select —</option>
                    {(reference?.specializations || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__other__">Other (specify below)</option>
                  </select>
                  {form.specialization_choice === "__other__" && (
                    <input
                      data-testid="staff-spec-other"
                      value={form.specialization || ""}
                      onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                      placeholder="Type doctor type / specialization"
                      className="w-full mt-2 px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
                    />
                  )}
                </div>
              )}
              {modalKind === "service" && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                    Services offered
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(reference?.services || []).map((s) => {
                      const on = form.service_tags?.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              service_tags: on
                                ? (f.service_tags || []).filter((x) => x !== s)
                                : [...(f.service_tags || []), s],
                            }))
                          }
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            on
                              ? "bg-forest text-white border-forest"
                              : "bg-white text-ink border-cream-300 hover:border-forest"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                  Photo (optional)
                </label>
                {form.photo && (
                  <img src={form.photo} alt="" className="w-20 h-20 rounded-xl object-cover mb-2" />
                )}
                <input type="file" accept="image/*" onChange={onPhoto} className="text-xs" data-testid="staff-photo" />
              </div>
              {modalKind === "service" && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                      Address
                    </label>
                    <input
                      value={form.address || ""}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
                    />
                  </div>
                  <button
                    onClick={useLocation}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
                    data-testid="staff-fetch-location"
                  >
                    <MapPin size={12} />
                    {form.latitude ? `Location saved (${form.latitude.toFixed(3)}, ${form.longitude.toFixed(3)})` : "Fetch Google Maps location"}
                  </button>
                </>
              )}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">
                  Daily slot limit (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.daily_slot_limit ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, daily_slot_limit: v ? parseInt(v, 10) : null });
                  }}
                  placeholder="Leave empty for unlimited"
                  data-testid="staff-slot-limit"
                  className="w-full px-3 py-2 rounded-xl bg-cream border border-cream-300 focus:border-forest focus:outline-none text-sm"
                />
                <p className="text-[10px] text-ink-muted mt-1">
                  How many customers can book this {modalKind === "doctor" ? "doctor" : "service"} per day.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border-2 border-cream-300 font-bold text-ink text-sm hover:border-forest"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                data-testid="staff-submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-dark disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
