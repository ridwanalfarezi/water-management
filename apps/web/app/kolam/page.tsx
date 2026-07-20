"use client";

import { PondCard } from "@/components/pond-card";
import { AlertCircle, Droplets, RefreshCw } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
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
              <p className="mt-1 text-xs text-muted-foreground">Daftar kolam</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="status"
              aria-live="polite"
              className="flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium"
            >
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${loading ? "animate-pulse bg-info" : error ? "bg-destructive" : "bg-success"}`}
                ></span>
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${loading ? "bg-info" : error ? "bg-destructive" : "bg-success"}`}
                ></span>
              </span>
              {loading ? "Memuat data" : error ? "Data belum terhubung" : "Data terbaru"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        {error && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchPonds()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Coba lagi
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Kondisi semua kolam</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Lihat status air dan koneksi alat sebelum membuka rincian kolam.
            </p>
          </div>
          {!loading && ponds.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label={`${ponds.length} kolam terdaftar`}>
              <span className="font-semibold text-foreground">{ponds.length} kolam</span>
            {onlineCount > 0 && (
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                {onlineCount} alat aktif
              </span>
            )}
            {offlineCount > 0 && (
                <span className="flex items-center gap-1.5 text-zinc-700">
                  <span className="h-2 w-2 rounded-full bg-zinc-500" aria-hidden="true" />
                {offlineCount} alat tidak terhubung
              </span>
            )}
          </div>
          )}
        </div>

        {loading ? (
          <div aria-label="Memuat daftar kolam" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="min-h-48 animate-pulse rounded-xl border bg-card p-5">
                <div className="flex justify-between gap-4">
                  <div className="h-5 w-24 rounded bg-muted" />
                  <div className="h-5 w-28 rounded-full bg-muted" />
                </div>
                <div className="mt-8 h-9 w-20 rounded bg-muted" />
                <div className="mt-8 h-px bg-border" />
                <div className="mt-4 h-4 w-40 rounded bg-muted" />
              </div>
            ))}
            <span className="sr-only">Sedang mengambil kondisi kolam...</span>
          </div>
        ) : ponds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-card px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <Droplets className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">Belum ada kolam yang terhubung</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
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
