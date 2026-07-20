"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun } from "lucide-react";

interface AISummaryCardProps {
  pondId: number;
}

export function AISummaryCard({ pondId }: AISummaryCardProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai-summary?pondId=${pondId}`);
      const json = await res.json();

      if (json.success) {
        setSummary(json.summary);
      }
    } catch {
      // Keep last summary visible
    } finally {
      setLoading(false);
    }
  }, [pondId]);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30_000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchSummary]);

  return (
    <article className="h-full p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
          <Sun className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">Ringkasan kondisi</h3>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-zinc-100" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary ?? "Ringkasan belum tersedia. Status utama tetap dapat dibaca di atas."}
          </p>
        )}
      </div>
    </article>
  );
}
