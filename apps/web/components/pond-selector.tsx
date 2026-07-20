"use client";

import Link from "next/link";

interface PondSelectorProps {
  currentPondId: number;
  pondIds: number[];
}

export function PondSelector({ currentPondId, pondIds }: PondSelectorProps) {
  return (
    <nav
      aria-label="Pilih kolam"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1"
    >
      {pondIds.map((id) => (
        <Link
          key={id}
          href={`/kolam/${id}`}
          aria-current={id === currentPondId ? "page" : undefined}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-4 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            id === currentPondId
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
          }`}
        >
          Kolam {id}
        </Link>
      ))}
    </nav>
  );
}
