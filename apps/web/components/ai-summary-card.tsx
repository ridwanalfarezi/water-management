"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-amber-400/40 to-transparent" />

      <CardHeader className="flex flex-row items-center gap-2.5 pb-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50">
          <Sun className="h-3.5 w-3.5 text-amber-600" />
        </div>
        <CardTitle className="text-sm font-semibold">Ringkasan Kondisi</CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-100" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-zinc-100" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {summary}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
