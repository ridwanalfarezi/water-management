"use client";

import { ArrowRight, Clock3, FlaskConical } from "lucide-react";
import Link from "next/link";
import { getPondStatusLabel } from "@/lib/user-copy";

interface PondCardProps {
  pondId: number;
  phLevel: number | null;
  connectionStatus: "online" | "offline";
  waterStatus: "normal" | "peringatan" | "kritis" | "belum_ada_data";
  lastSeenAt: string;
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
    timeZone: "Asia/Jakarta",
  });
}

export function PondCard({
  pondId,
  phLevel,
  connectionStatus,
  waterStatus,
  lastSeenAt,
}: PondCardProps) {
  const cfg = statusConfig[
    connectionStatus === "offline" ? "offline" : waterStatus
  ];
  const statusLabel = getPondStatusLabel(connectionStatus, waterStatus);
  const phOutsideTarget =
    phLevel !== null && (phLevel < 6.5 || phLevel > 7.5);

  return (
    <Link
      href={`/kolam/${pondId}`}
      className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Buka Kolam ${pondId}, status ${statusLabel}`}
    >
      <article
        className={`flex h-full min-h-48 flex-col rounded-xl border ${cfg.border} ${cfg.bg} p-5 transition-colors duration-200 group-hover:border-primary/40`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-900">
            Kolam {pondId}
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} aria-hidden="true" />
            {statusLabel}
          </span>
        </div>

        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-600">pH saat ini</p>
            <div className="mt-1 flex items-center gap-2">
            <FlaskConical
                className={`h-5 w-5 ${phOutsideTarget ? "text-amber-600" : "text-zinc-500"}`}
                aria-hidden="true"
            />
            <span
                className={`text-3xl font-bold tracking-tight ${phOutsideTarget ? "text-amber-700" : "text-zinc-950"}`}
            >
              {phLevel?.toFixed(1) ?? "--"}
            </span>
          </div>
          </div>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-current/10 bg-white/70 px-3 text-sm font-semibold text-zinc-700 transition-colors group-hover:bg-white group-hover:text-primary-dark">
            Buka
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-current/10 pt-4 text-xs font-medium text-zinc-600">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {connectionStatus === "online" ? "Diperbarui" : "Terakhir terhubung"}{" "}
            pukul {formatLastSeen(lastSeenAt)}
          </span>
        </div>
      </article>
    </Link>
  );
}
