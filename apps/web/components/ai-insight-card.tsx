"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AIInsightCard() {
  const [insight, setInsight] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInsight = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-insight");
      const json = await res.json();

      if (json.success) {
        setInsight(json.insight);
        setSource(json.source);
      }
    } catch {
      // Silently fail — keep the last insight visible
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
    const interval = setInterval(fetchInsight, 15_000);
    return () => clearInterval(interval);
  }, [fetchInsight]);

  return (
    <Card className="relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-zinc-400/40 to-transparent" />

      <CardHeader className="flex flex-row items-center gap-2.5 pb-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
          <Sparkles className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
        </div>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">AI Insight</CardTitle>
          {source && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {source === "ai" ? "Gemini" : "Auto"}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {insight}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
