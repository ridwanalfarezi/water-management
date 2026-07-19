"use client";

import { PondCard } from "@/components/pond-card";
import { Activity, Droplets } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

interface PondData {
  pond_id: number;
  temperature: number | null;
  do_level: number | null;
  ph_level: number | null;
  created_at: string | null;
  last_seen_at: string;
  connection_status: "online" | "offline";
  water_status: "normal" | "peringatan" | "kritis" | "belum_ada_data";
}

export default function SemuaKolamPage() {
  const [ponds, setPonds] = useState<PondData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPonds = useCallback(async () => {
    try {
      const res = await fetch("/api/ponds");
      const json = await res.json();
      if (json.success) {
        setPonds(json.data);
        setError(null);
      } else {
        setError("Kondisi kolam belum dapat dimuat. Sistem akan mencoba lagi.");
      }
    } catch {
      setError("Koneksi sedang terganggu. Sistem akan mencoba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPonds();
    const interval = setInterval(fetchPonds, 5000);
    return () => clearInterval(interval);
  }, [fetchPonds]);

  const onlineCount = ponds.filter(
    (p) => p.connection_status === "online",
  ).length;
  const offlineCount = ponds.length - onlineCount;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-8 w-8 animate-pulse text-muted-foreground/50" />
          <p className="text-sm font-medium">Sedang mengambil kondisi kolam...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white p-1">
              <Image
                src="/logo-pict.png"
                alt="KolamPintar Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none tracking-tight text-primary-dark">
                KolamPintar
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Daftar kolam</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? "bg-destructive" : "bg-success"}`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${error ? "bg-destructive" : "bg-success"}`}
                ></span>
              </span>
              {error ? "Data belum terhubung" : "Data terbaru"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-8">
        {/* Error */}
        {error && (
          <div className="mb-8 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
            {error}
          </div>
        )}

        {/* Summary Bar */}
        <div className="mb-6 flex items-center gap-4 text-sm">
          <span className="font-semibold text-zinc-900">
            {ponds.length} Kolam
          </span>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-3">
            {onlineCount > 0 && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {onlineCount} alat aktif
              </span>
            )}
            {offlineCount > 0 && (
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                {offlineCount} alat tidak terhubung
              </span>
            )}
          </div>
        </div>

        {/* Pond Grid */}
        {ponds.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed px-6 py-20 text-center text-muted-foreground">
            <Droplets className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">Belum ada kolam yang terhubung</p>
            <p className="mx-auto mt-1 max-w-sm text-xs">
              Pastikan alat kolam menyala dan tersambung ke Wi-Fi. Kolam akan muncul otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ponds.map((pond) => (
              <PondCard
                key={pond.pond_id}
                pondId={pond.pond_id}
                phLevel={pond.ph_level}
                connectionStatus={pond.connection_status}
                waterStatus={pond.water_status}
                lastSeenAt={pond.last_seen_at}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
