"use client";

import { ArrowRight, FlaskConical } from "lucide-react";
import Link from "next/link";
import { getPondStatusLabel } from "@/lib/user-copy";

interface PondCardProps {
  pondId: number;
  phLevel: number | null;
  connectionStatus: "online" | "offline";
  waterStatus: "normal" | "peringatan" | "kritis" | "belum_ada_data";
  lastSeenAt: string;
  simulated?: boolean;
}

const statusConfig = {
  normal: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
  },
  peringatan: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  kritis: {
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500 animate-pulse",
  },
  belum_ada_data: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    badge: "bg-sky-100 text-sky-800",
    dot: "bg-sky-500",
  },
  offline: {
    bg: "bg-zinc-50",
    border: "border-zinc-200",
    badge: "bg-zinc-200 text-zinc-700",
    dot: "bg-zinc-500",
  },
};

function formatLastSeen(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function PondCard({
  pondId,
  phLevel,
  connectionStatus,
  waterStatus,
  lastSeenAt,
  simulated = false,
}: PondCardProps) {
  const cfg = statusConfig[
    connectionStatus === "offline" ? "offline" : waterStatus
  ];
  const statusLabel = getPondStatusLabel(connectionStatus, waterStatus);
  const phOutsideTarget =
    phLevel !== null && (phLevel < 6.5 || phLevel > 8.5);

  return (
    <Link
      href={`/kolam/${pondId}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Buka Kolam ${pondId}, status ${statusLabel}`}
    >
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
            {statusLabel}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-lg bg-white/60 p-3">
            <FlaskConical
              className={`h-4 w-4 ${phOutsideTarget ? "text-amber-500" : "text-zinc-500"}`}
            />
            <span
              className={`text-lg font-bold ${phOutsideTarget ? "text-amber-600" : "text-zinc-900"}`}
            >
              {phLevel?.toFixed(1) ?? "--"}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
              {simulated ? "pH simulasi" : "pH"}
            </span>
          </div>
        </div>

        {/* Footer action */}
        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-medium text-zinc-500">
          <span>
            {connectionStatus === "online" ? "Diperbarui" : "Terakhir terhubung"}{" "}
            pukul {formatLastSeen(lastSeenAt)}
          </span>
          <span className="flex items-center gap-1 transition-colors group-hover:text-zinc-800">
            Buka kolam
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
