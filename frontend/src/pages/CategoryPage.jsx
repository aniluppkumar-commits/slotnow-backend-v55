import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import CategoryIcon from "@/components/CategoryIcon";
import { ProviderCard } from "@/pages/Home";
import { catStyle } from "@/lib/utils-app";
import { Loader2 } from "lucide-react";

export default function CategoryPage() {
  const { id } = useParams();
  const [category, setCategory] = useState(null);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [catRes, provRes] = await Promise.all([
          api.get("/categories"),
          api.get("/providers", { params: { category_id: id } }).catch(() =>
            api.get("/providers")
          ),
        ]);
        if (!mounted) return;
        const cat = (catRes.data || []).find((c) => c.id === id);
        setCategory(cat);
        const list = (provRes.data || []).filter((p) => p.category_id === id);
        setProviders(list);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [id]);

  const style = catStyle(category?.color);

  return (
    <AppShell title={category?.name || "Category"} showBack>
      <div className="px-4 sm:px-6 pt-4">
        {category && (
          <div className={`rounded-2xl p-5 mb-5 ring-1 ${style.bg} ${style.ring}`}>
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl bg-white/60 flex items-center justify-center ${style.text}`}>
                <CategoryIcon name={category.icon} size={28} />
              </div>
              <div>
                <h2 className={`font-heading text-2xl font-extrabold tracking-tight ${style.text}`}>
                  {category.name}
                </h2>
                <p className={`text-sm font-deva ${style.text} opacity-80`}>
                  {category.name_hi}
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-forest" />
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-soft">No providers available in this category yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} category={category} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
