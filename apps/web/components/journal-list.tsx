"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen } from "lucide-react";

interface JournalEntry {
  id: number;
  pond_id: number;
  entry_type: string;
  content: string;
  created_at: string;
}

interface JournalListProps {
  pondId: number;
  refreshKey?: number;
}

const typeBadgeConfig: Record<string, { label: string; className: string }> = {
  pakan: { label: "Pemberian pakan", className: "bg-blue-100 text-blue-700" },
  pengapuran: { label: "Pengapuran", className: "bg-amber-100 text-amber-700" },
  sampling: { label: "Pengecekan air", className: "bg-purple-100 text-purple-700" },
  catatan: { label: "Catatan lainnya", className: "bg-zinc-100 text-zinc-700" },
};

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

export function JournalList({ pondId, refreshKey }: JournalListProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/journal?pondId=${pondId}`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [pondId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshKey]);

  return (
    <section className="h-full p-5 sm:p-6" aria-labelledby={`journal-list-title-${pondId}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100">
          <BookOpen className="h-3.5 w-3.5 text-zinc-700" aria-hidden="true" />
        </div>
        <h3 id={`journal-list-title-${pondId}`} className="text-sm font-semibold">Catatan hari ini</h3>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-100" />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg bg-muted/60 px-4 py-5 text-sm text-muted-foreground">
            Belum ada catatan hari ini. Tambahkan kegiatan penting agar riwayat kolam mudah ditelusuri.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const badge = typeBadgeConfig[entry.entry_type] || typeBadgeConfig.catatan;
              return (
                <div
                  key={entry.id}
                  className="flex gap-3 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider mb-1 ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <p className="text-sm text-zinc-700 leading-relaxed">
                      {entry.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
