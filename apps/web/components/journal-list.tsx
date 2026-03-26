"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  pakan: { label: "Pakan", className: "bg-blue-100 text-blue-700" },
  pengapuran: { label: "Pengapuran", className: "bg-amber-100 text-amber-700" },
  sampling: { label: "Sampling", className: "bg-purple-100 text-purple-700" },
  catatan: { label: "Catatan", className: "bg-zinc-100 text-zinc-600" },
};

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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2.5 pb-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100">
          <BookOpen className="h-3.5 w-3.5 text-zinc-600" />
        </div>
        <div>
          <CardTitle className="text-sm font-semibold">Riwayat Hari Ini</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-100" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada catatan hari ini.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const badge = typeBadgeConfig[entry.entry_type] || typeBadgeConfig.catatan;
              return (
                <div
                  key={entry.id}
                  className="flex gap-3 rounded-lg border bg-zinc-50/50 p-3"
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
      </CardContent>
    </Card>
  );
}
