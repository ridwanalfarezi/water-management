"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { DEMO_STAGES, type DemoStep } from "@/lib/demo";
import { LowPhAlert } from "@/components/low-ph-alert";

interface Reading { ph_level: number | null; created_at: string; solenoid_state: "ON" | "OFF" | null; }
interface Device {
  demo_step: DemoStep | null;
  data_source: string | null;
  ph_level: number | null;
  solenoid_state: "ON" | "OFF" | null;
  created_at: string | null;
}
const audienceDescriptions: Record<DemoStep, string> = {
  NORMAL: "Kondisi air stabil.",
  FOOD: "Sisa pakan dapat memengaruhi kualitas air.",
  DANGER: "Kualitas air berubah. Sistem mendeteksi pH rendah.",
  ACTIVE: "Valve terbuka sebagai respons terhadap pH rendah.",
  RECOVERY: "pH air berangsur kembali normal.",
  RESTORED: "Kondisi air kembali stabil.",
  READY: "Giliran kamu mencoba fishing game bersama crew.",
  STOPPED: "Proses berhenti. Valve tertutup.",
};
const phases = [
  { label: "Air normal", steps: ["NORMAL"] },
  { label: "Pemberian pakan", steps: ["FOOD"] },
  { label: "pH rendah", steps: ["DANGER"] },
  { label: "Respons valve", steps: ["ACTIVE"] },
  { label: "Pemulihan", steps: ["RECOVERY", "RESTORED"] },
  { label: "Fishing game", steps: ["READY"] },
];

export function AudienceMonitor({ pondId, data, device, available, paused, error }: {
  pondId: number; data: Reading[]; device: Device | null;
  available: boolean; paused: boolean; error: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const age = device?.created_at ? now - Date.parse(device.created_at) : Infinity;
  const fresh = available && age >= -1000 && age < 5000;
  const step = fresh ? device?.demo_step ?? null : null;
  const stage = step ? DEMO_STAGES[step] : null;
  const simulated = device?.data_source === "SIMULATION";
  const ph = fresh ? device?.ph_level ?? null : null;
  const valve = fresh ? device?.solenoid_state ?? null : null;
  const low = ph !== null && ph < 6.5;
  const high = ph !== null && ph > 8.5;
  const currentPhase = phases.findIndex((phase) => step !== null && phase.steps.includes(step));
  const title = !fresh ? "Menunggu perangkat terhubung" : paused ? "Demo dijeda" : stage?.title ?? "Menunggu demo";
  const chart = [...data].reverse().map((reading) => ({
    time: new Date(reading.created_at).toLocaleTimeString("id-ID", { hour12: false }), ph: reading.ph_level,
  }));
  return (
    <main className="min-h-dvh bg-background px-4 py-5 text-zinc-900 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-pict.png" alt="" width={48} height={48} />
            <div><h1 className="text-2xl font-bold sm:text-3xl">Kolam Pintar</h1><p className="text-base text-zinc-600">Kolam {pondId} · {simulated ? "Data simulasi" : "Monitor kondisi air"}</p></div>
          </div>
          <p role="status" className={`flex items-center gap-2 text-lg font-medium ${fresh ? "text-emerald-800" : "text-red-800"}`}><span aria-hidden="true" className={`h-3 w-3 rounded-full ${fresh ? "bg-emerald-600" : "bg-red-600"}`} />{fresh ? "Perangkat terhubung" : "Data terbaru belum tersedia"}</p>
        </header>
        <section aria-label="Proses demo" className={`rounded-xl border p-5 sm:p-6 ${!fresh ? "border-zinc-300 bg-zinc-100" : low ? "border-red-300 bg-red-50" : stage?.tone === "active" ? "border-blue-200 bg-blue-50" : "border-emerald-200 bg-emerald-50"}`}>
          <h2 role="status" aria-live="polite" className="text-3xl font-semibold leading-tight sm:text-4xl">{title}</h2>
          <p className="mt-2 max-w-4xl text-lg text-zinc-700 sm:text-xl">{!fresh ? error ? "Koneksi terputus. Menunggu perangkat kembali terhubung." : "Menunggu kondisi air terbaru." : paused ? "Proses sementara berhenti. Valve tertutup." : step ? audienceDescriptions[step] : ""}</p>
        </section>
        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2.4fr)]">
          <section aria-label="Kondisi air dan valve" className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-xl font-medium">pH air</h2>
            <p className={`mt-3 text-6xl font-bold tabular-nums sm:text-7xl ${low ? "text-red-700" : high ? "text-amber-800" : "text-primary-dark"}`}>{ph?.toFixed(2) ?? "—"}</p>
            <p className="mt-3 text-lg font-medium">{ph === null ? "Belum tersedia" : low ? "pH rendah" : high ? "pH tinggi" : "Normal"}</p>
            <div className="mt-6 border-t border-border pt-5"><h3 className="text-lg text-zinc-600">Valve</h3><p className={`mt-1 text-3xl font-semibold ${valve === "ON" ? "text-primary-dark" : ""}`}>{valve === "ON" ? "Terbuka" : valve === "OFF" ? "Tertutup" : "Belum diketahui"}</p></div>
          </section>
          <section aria-label="Grafik perubahan pH" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold sm:text-2xl">Perubahan pH</h2></div>
            <div className="mt-4 h-60 w-full overflow-hidden sm:h-64">
              {chart.length === 0 ? <p className="flex h-full items-center justify-center text-lg text-zinc-600">Menunggu bacaan pH…</p> : <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 18, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid vertical={false} stroke="#e4e4e7" />
                  <XAxis dataKey="time" minTickGap={65} stroke="#52525b" fontSize={14} tickLine={false} axisLine={false} />
                  <YAxis domain={[5.8, 8.8]} ticks={[6, 6.5, 7, 7.5, 8, 8.5]} stroke="#52525b" fontSize={16} tickLine={false} axisLine={false} width={42} />
                  <ReferenceLine y={6.5} stroke="#b91c1c" strokeDasharray="5 5" />
                  <ReferenceLine y={8.5} stroke="#92400e" strokeDasharray="5 5" />
                  <Line dataKey="ph" stroke="#1457d4" strokeWidth={3} dot={false} isAnimationActive={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>}
            </div>
            {!fresh && chart.length > 0 && <p className="text-base text-red-800">Data terakhir · Menunggu koneksi</p>}
          </section>
        </div>
        {simulated && <LowPhAlert audience ph={ph} timestamp={device?.created_at ?? null} actionRequired={step === "DANGER"} available={fresh && !paused && ["FOOD", "DANGER", "ACTIVE", "RECOVERY"].includes(step ?? "")} />}
        <ol aria-label="Urutan proses demo" className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {phases.map((phase, index) => <li key={phase.label} aria-current={index === currentPhase ? "step" : undefined} className={`flex items-center gap-3 rounded-md border px-3 py-3 text-base font-medium ${index === currentPhase ? "border-primary bg-primary text-white" : "border-border bg-card text-zinc-700"}`}><span className="tabular-nums" aria-hidden="true">{index + 1}</span>{phase.label}</li>)}
        </ol>
      </div>
    </main>
  );
}
