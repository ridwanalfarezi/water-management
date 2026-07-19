import { ChevronDown } from "lucide-react";

interface TechnicalDetailItem {
  label: string;
  value: string | number | null | undefined;
}

interface TechnicalDetailsProps {
  summary?: string;
  items: TechnicalDetailItem[];
}

export function TechnicalDetails({
  summary = "Lihat detail perangkat",
  items,
}: TechnicalDetailsProps) {
  const visibleItems = items.filter(
    (item) => item.value !== null && item.value !== undefined && item.value !== "",
  );
  if (visibleItems.length === 0) return null;

  return (
    <details className="group text-xs text-muted-foreground">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm font-medium text-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <dl className="mt-2 grid gap-1.5 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <div key={item.label} className="flex min-w-0 justify-between gap-3 sm:block">
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="break-all font-mono text-[11px] text-foreground/80">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
