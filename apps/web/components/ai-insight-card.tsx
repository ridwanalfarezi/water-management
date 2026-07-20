"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";

interface AIInsightCardProps {
  pondId?: number;
}

export function AIInsightCard({ pondId }: AIInsightCardProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInsight = useCallback(async () => {
    try {
      const url = pondId
        ? `/api/ai-insight?pondId=${pondId}`
        : "/api/ai-insight";
      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setInsight(json.insight);
      }
    } catch {
      // Silently fail — keep the last insight visible
    } finally {
      setLoading(false);
    }
  }, [pondId]);

  useEffect(() => {
    fetchInsight();
    const interval = setInterval(fetchInsight, 15_000);
    return () => clearInterval(interval);
  }, [fetchInsight]);

  return (
    <article className="h-full p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold">Saran untuk kolam</h3>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {insight ?? "Belum ada saran tambahan untuk kondisi saat ini."}
          </p>
        )}
      </div>
    </article>
  );
}
