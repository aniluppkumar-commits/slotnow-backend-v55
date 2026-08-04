import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { useI18n } from "@/i18n";
import { Loader2, Plus, Trash2, ShieldOff, ShieldCheck, UserCog, ListChecks, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { compressImageToDataURL } from "@/lib/image";

export default function ProviderAssistants() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", designation: "", photo: "" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [assignFor, setAssignFor] = useState(null); // assistant object being edited
  const [editPhotoFor, setEditPhotoFor] = useState(null); // assistant object whose photo we're replacing
  const photoInputRef = useRef(null);

  const load = async () => {
    try {
      const [ares, sres] = await Promise.all([
        api.get("/providers/me/assistants"),
        api.get("/providers/me/staff").catch(() => ({ data: [] })),
      ]);
      setItems(Array.isArray(ares.data) ? ares.data : ares.data?.items || []);
      setStaff(sres.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    if (!/^\d{10}$/.test(form.phone)) return toast.error("Valid 10-digit phone required");
    setSaving(true);
    try {
      await api.post("/providers/me/assistants", {
        name: form.name,
        phone: form.phone,
        designation: form.designation || "",
        photo: form.photo || null,
      });
      toast.success("Assistant added");
      setForm({ name: "", phone: "", designation: "", photo: "" });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImageToDataURL(file, { maxDim: 512, quality: 0.72 });
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      toast.error("Could not read image");
    } finally {
      setPhotoBusy(false);
    }
  };

  const updateAssistantPhoto = async (assistant, file) => {
    if (!file) return;
    setBusyId(assistant.id);
    try {
      const dataUrl = await compressImageToDataURL(file, { maxDim: 512, quality: 0.72 });
      // Reuse the upsert endpoint — same phone/name/designation, new photo.
      await api.post("/providers/me/assistants", {
        name: assistant.name,
        phone: assistant.phone,
        designation: assistant.designation || "",
        photo: dataUrl,
      });
      toast.success("Photo updated");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not update photo");
    } finally {
      setBusyId(null);
      setEditPhotoFor(null);
    }
  };

  const toggleBlock = async (a) => {
    setBusyId(a.id);
    try {
      await api.put(`/providers/me/assistants/${a.id}/block`, { blocked: !a.blocked });
      toast.success(a.blocked ? "Unblocked" : "Blocked");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Remove ${a.name}?`)) return;
    setBusyId(a.id);
    try {
      await api.delete(`/providers/me/assistants/${a.id}`);
      toast.success("Removed");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppShell title="Service Assistants" showBack>
      <div className="px-4 sm:px-6 pt-4 space-y-5">
        {/* Add form */}
        <div className="bg-white border border-cream-300 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-soft flex items-center gap-1.5">
            <UserCog size={13} strokeWidth={2.5} />
            Add assistant
          </p>
          <input
            data-testid="assistant-name-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name *"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <input
            data-testid="assistant-phone-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder="Phone (10-digit) *"
            inputMode="numeric"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          <input
            data-testid="assistant-designation-input"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="Designation (optional)"
            className="w-full bg-cream border border-cream-300 rounded-xl px-3 py-2.5 text-ink outline-none focus:ring-2 focus:ring-forest/20"
          />
          {/* Photo upload — shown in provider assistant list, receptionist dashboard,
              and next to their name so patients can visually identify them at the counter. */}
          <div className="flex items-center gap-3">
            {form.photo ? (
              <img
                data-testid="assistant-photo-preview"
                src={form.photo}
                alt="Assistant"
                className="w-14 h-14 rounded-xl object-cover border border-cream-300"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-cream border border-dashed border-cream-300 flex items-center justify-center text-ink-soft">
                <Camera size={18} />
              </div>
            )}
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <input
                ref={photoInputRef}
                data-testid="assistant-photo-input"
                type="file"
                accept="image/*"
                onChange={pickPhoto}
                className="hidden"
              />
              <button
                type="button"
                data-testid="assistant-photo-pick-btn"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cream border border-cream-300 hover:border-forest/40 disabled:opacity-60"
              >
                {photoBusy ? "Reading…" : form.photo ? "Change photo" : "Upload photo"}
              </button>
              {form.photo && (
                <button
                  type="button"
                  data-testid="assistant-photo-remove-btn"
                  onClick={() => setForm((f) => ({ ...f, photo: "" }))}
                  className="text-xs font-bold text-rose-600 px-2 py-1.5"
                >
                  Remove
                </button>
              )}
              <span className="text-[10px] text-ink-soft w-full sm:w-auto">Optional · shown on the assistant desk header.</span>
            </div>
          </div>
          <button
            data-testid="assistant-add-btn"
            onClick={add}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-accent text-white py-2.5 rounded-xl font-bold hover:bg-accent-dark disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Add</>}
          </button>
          <p className="text-[11px] text-ink-soft">
            Your assistant will log in at slotnow with the role <strong>Service Assistant</strong> and this same phone number.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-soft italic text-center py-6">No assistants yet</p>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <div
                key={a.id}
                data-testid={`assistant-item-${a.id}`}
                className={`bg-white border border-cream-300 rounded-xl p-3 flex items-center gap-3 ${
                  a.blocked ? "opacity-60" : ""
                }`}
              >
                <div className="relative">
                  {a.photo ? (
                    <img
                      data-testid={`assistant-photo-${a.id}`}
                      src={a.photo}
                      alt={a.name || "Assistant"}
                      className="w-12 h-12 rounded-xl object-cover border border-cream-300"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-forest-faint text-forest flex items-center justify-center font-bold">
                      {a.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <label
                    data-testid={`assistant-photo-edit-${a.id}`}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-forest text-white flex items-center justify-center border-2 border-white cursor-pointer hover:bg-forest-dark"
                    title="Update photo"
                  >
                    <Camera size={11} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) updateAssistantPhoto(a, f);
                      }}
                    />
                  </label>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink truncate">{a.name}</p>
                  <p className="text-[11px] text-ink-soft truncate">
                    +91 {a.phone} {a.designation && `· ${a.designation}`}
                  </p>
                  {/* Show current assignment count so admin sees the mapping status at a glance */}
                  <p data-testid={`assistant-mapping-${a.id}`} className="text-[11px] font-bold text-forest mt-0.5">
                    <ListChecks size={11} className="inline -mt-0.5 mr-0.5" />
                    Mapped to {(a.assigned_staff_ids || []).length} / 3 doctors/services
                    {(a.assigned_staff_ids || []).length === 0 && <span className="text-rose-500 ml-1">— tap Assign to map</span>}
                  </p>
                  {a.blocked && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                      Blocked
                    </span>
                  )}
                </div>
                <button
                  data-testid={`assistant-block-${a.id}`}
                  onClick={() => toggleBlock(a)}
                  disabled={busyId === a.id}
                  className={`p-2 rounded-lg ${a.blocked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {a.blocked ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                </button>
                <button
                  data-testid={`assistant-assign-${a.id}`}
                  onClick={() => {
                    if (staff.length === 0) {
                      toast.error("Add at least one doctor or service first (Manage doctors & services)");
                      return;
                    }
                    setAssignFor(a);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-forest text-cream-100 font-bold text-xs hover:bg-forest-dark"
                  title="Assign doctors / services (max 3)"
                >
                  <ListChecks size={14} /> Assign
                </button>
                <button
                  data-testid={`assistant-remove-${a.id}`}
                  onClick={() => remove(a)}
                  disabled={busyId === a.id}
                  className="p-2 rounded-lg bg-rose-50 text-rose-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {assignFor && (
        <AssignModal
          assistant={assignFor}
          staff={staff}
          onClose={() => setAssignFor(null)}
          onSaved={() => { setAssignFor(null); load(); }}
        />
      )}
    </AppShell>
  );
}

function AssignModal({ assistant, staff, onClose, onSaved }) {
  const [ids, setIds] = useState(Array.isArray(assistant.assigned_staff_ids) ? assistant.assigned_staff_ids : []);
  const [saving, setSaving] = useState(false);
  const MAX_ASSIGN = 3;
  const toggle = (sid) =>
    setIds((prev) => {
      if (prev.includes(sid)) return prev.filter((x) => x !== sid);
      if (prev.length >= MAX_ASSIGN) {
        toast.error(`You can assign at most ${MAX_ASSIGN} doctors/services per assistant`);
        return prev;
      }
      return [...prev, sid];
    });
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/providers/me/assistants/${assistant.id}/staff`, { staff_ids: ids });
      toast.success("Assignments updated");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };
  const doctors = staff.filter((s) => s.kind === "doctor");
  const centers = staff.filter((s) => s.kind === "service");
  return (
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-heading text-lg font-black text-ink">Assign to {assistant.name}</h3>
            <p className="text-xs text-ink-muted">
              Pick up to <b>{MAX_ASSIGN}</b> doctors/services. Empty = full access to every staff.
            </p>
            <p data-testid="assign-count" className={`text-[11px] font-bold mt-1 ${ids.length >= MAX_ASSIGN ? "text-rose-500" : "text-forest"}`}>
              {ids.length} / {MAX_ASSIGN} selected
            </p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close"><X size={20} /></button>
        </div>
        {doctors.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Doctors</p>
            <div className="space-y-1.5">
              {doctors.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ids.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    data-testid={`assign-${s.id}`}
                  />
                  <span className="text-ink">
                    {s.name}
                    {s.specialization && <span className="text-forest text-xs ml-1">· {s.specialization}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {centers.length > 0 && (
          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">Other Services</p>
            <div className="space-y-1.5">
              {centers.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ids.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    data-testid={`assign-${s.id}`}
                  />
                  <span className="text-ink">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border-2 border-cream-300 font-bold text-ink text-sm hover:border-forest" disabled={saving}>Cancel</button>
          <button onClick={save} data-testid="assign-save" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-forest text-white font-bold text-sm hover:bg-forest-dark disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
