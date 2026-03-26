"use client";

import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "next/link";

interface PondCardProps {
  pondId: number;
  phLevel: number | null;
  status: "normal" | "peringatan" | "kritis";
}

const statusConfig = {
  normal: {
    label: "Normal",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  peringatan: {
    label: "Peringatan",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  kritis: {
    label: "Kritis",
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500 animate-pulse",
  },
};

export function PondCard({ pondId, phLevel, status }: PondCardProps) {
  const cfg = statusConfig[status];

  return (
    <Link href={`/kolam/${pondId}`} className="block group">
      <div
        className={`relative rounded-xl border ${cfg.border} ${cfg.bg} p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-zinc-900">
            Kolam {pondId}
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-white/60 p-3">
            <FlaskConical
              className={`h-4 w-4 ${phLevel !== null && phLevel < 6.5 ? "text-amber-500" : "text-zinc-500"}`}
            />
            <span
              className={`text-lg font-bold ${phLevel !== null && phLevel < 6.5 ? "text-amber-600" : "text-zinc-900"}`}
            >
              {phLevel?.toFixed(1) ?? "--"}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              pH
            </span>
          </div>
        </div>

        {/* Footer action */}
        <div className="mt-4 flex items-center justify-end gap-1 text-xs font-medium text-zinc-400 group-hover:text-zinc-600 transition-colors">
          <span>Lihat Detail</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
