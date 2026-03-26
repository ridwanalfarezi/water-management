"use client";

import Link from "next/link";

interface PondSelectorProps {
  currentPondId: number;
  pondIds: number[];
}

export function PondSelector({ currentPondId, pondIds }: PondSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 p-1">
      {pondIds.map((id) => (
        <Link
          key={id}
          href={`/kolam/${id}`}
          className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
            id === currentPondId
              ? "bg-white text-zinc-900 shadow-sm"
              : "text-zinc-500 hover:text-zinc-700 hover:bg-white/50"
          }`}
        >
          Kolam {id}
        </Link>
      ))}
    </div>
  );
}
