"use client";

import { DEMO_ADVANCE, DEMO_STAGES } from "@/lib/demo";
import type { DemoController } from "@/hooks/use-demo-controller";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const buttonClass = "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function DemoControls({ controller }: { controller: DemoController }) {
  const { ready, step, paused, pending, feedback, send } = controller;
  const stage = step ? DEMO_STAGES[step] : null;
  const advance = step ? DEMO_ADVANCE[step] : null;
  return (
    <Card id="expo-demo-controls" tabIndex={-1}>
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Kontrol demo expo</CardTitle>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-primary-dark">Data simulasi</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Panduan crew: kondisi normal → pakan → pH rendah → valve → pulih → game. Valve bekerja tanpa bahan koreksi pH.</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${!ready ? "border-zinc-200 bg-zinc-50 text-zinc-700" : stage?.tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : stage?.tone === "active" ? "border-blue-200 bg-blue-50 text-blue-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          <p className="text-xs">Tahap saat ini</p>
          <p className="mt-1 font-medium">{!ready ? "Menunggu firmware demo terhubung" : paused ? "Demo dijeda · Valve tertutup" : stage?.title}</p>
          <p className="mt-1 text-xs leading-relaxed">{ready ? paused ? "pH dibekukan. Tekan Lanjutkan demo untuk meneruskan cerita; valve tidak dibuka ulang jika jeda dilakukan saat valve aktif." : stage?.description : "Nyalakan perangkat dengan firmware expo. Tombol aktif setelah status perangkat diterima."}</p>
        </div>
        {ready && advance && !paused && <div className="mb-4 text-sm">
          <p className="font-medium">Berikutnya: {advance.next}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{advance.description}</p>
        </div>}
        <button className={`${buttonClass} mb-3 w-full border-primary bg-primary text-white hover:bg-primary/90`}
          disabled={!ready || !!pending || paused || !advance?.action}
          onClick={() => { if (advance?.action) void send(advance.action); }}>
          {pending ? "Menunggu perangkat…" : paused ? "Demo dijeda" : advance?.label ?? "Menunggu perangkat"}
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button className={buttonClass} disabled={!ready || !!pending || step === "STOPPED" || step === "READY"} onClick={() => void send(paused ? "RESUME" : "PAUSE")}>{paused ? "Lanjutkan demo" : "Jeda"}</button>
          <button className={buttonClass} disabled={!ready || pending === "RESET" || pending === "STOP"} onClick={() => void send("RESET")}>Reset</button>
          <button className={`${buttonClass} border-red-200 text-red-700 hover:bg-red-50`} disabled={!ready || pending === "STOP"} onClick={() => void send("STOP")}>Hentikan</button>
        </div>
        <details className="mt-3 text-xs leading-relaxed text-muted-foreground">
          <summary className="min-h-11 cursor-pointer py-3 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Fungsi Jeda, Reset, dan Hentikan</summary>
          <div className="space-y-1 pb-2">
          <p><span className="font-medium text-foreground">Jeda:</span> tutup valve dan bekukan pH sementara.</p>
          <p><span className="font-medium text-foreground">Reset:</span> tutup valve, kembalikan pH ke 7,5 dan cerita ke awal.</p>
          <p><span className="font-medium text-foreground">Hentikan:</span> tutup valve dan akhiri putaran demo.</p>
          </div>
        </details>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground" role="status" aria-live="polite">{feedback || "Tahap berubah setelah perangkat mengonfirmasi perintah. Waktu pemulihan dipercepat untuk expo."}</p>
      </CardContent>
    </Card>
  );
}
