"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_STAGES, type DemoAction, type DemoStep } from "@/lib/demo";

export interface DemoDevice {
  pond_id: number;
  connection_status: "online" | "offline";
  created_at: string | null;
  data_source: string | null;
  demo_step: DemoStep | null;
  demo_paused: boolean | null;
  demo_revision: string | null;
  demo_session: string | null;
}

// One command queue shared by the panel and alert popup.
export function useDemoController({ device, connected, pondId, onApplied }: {
  device: DemoDevice | null; connected: boolean; pondId: number; onApplied: () => Promise<void>;
}) {
  const [pending, setPending] = useState<DemoAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const commandRequest = useRef<AbortController | null>(null);
  const commandGeneration = useRef(0);
  useEffect(() => {
    setPending(null);
    setFeedback("");
    return () => { ++commandGeneration.current; commandRequest.current?.abort(); commandRequest.current = null; };
  }, [pondId]);
  const step = device?.demo_step && device.demo_step in DEMO_STAGES ? device.demo_step : null;
  const age = device?.created_at ? Date.now() - new Date(device.created_at).getTime() : Infinity;
  const ready = connected && age >= -1000 && age < 5000 && device?.pond_id === pondId && device.data_source === "SIMULATION" && !!step && !!device.demo_session && device.demo_revision !== null;

  async function send(action: DemoAction): Promise<boolean> {
    const closing = action === "STOP" || action === "RESET";
    if (!device || !ready || (commandRequest.current && !closing)) return false;
    commandRequest.current?.abort();
    const controller = new AbortController();
    commandRequest.current = controller;
    const generation = ++commandGeneration.current;
    setPending(action);
    setFeedback("Menunggu konfirmasi dari ESP32…");
    try {
      const response = await fetch("/api/control", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pondId: device.pond_id, demoAction: action, demoSession: device.demo_session, demoRevision: Number(device.demo_revision) }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Perintah belum terkirim.");
      const deadline = Date.now() + 6500;
      while (Date.now() < deadline && !controller.signal.aborted) {
        const acknowledgement = await fetch(`/api/control/${result.commandId}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(2000)]) });
        const status = await acknowledgement.json();
        if (!acknowledgement.ok || !status.success) throw new Error("Status perintah belum tersedia.");
        if (["APPLIED", "APPLIED_LATE"].includes(status.data.status)) {
          if (generation !== commandGeneration.current) return false;
          setFeedback("Perintah dikonfirmasi ESP32. Tampilan mengikuti status terbaru perangkat.");
          await onApplied();
          return generation === commandGeneration.current;
        }
        if (["REJECTED", "REJECTED_LATE", "TIMED_OUT", "PUBLISH_FAILED"].includes(status.data.status)) {
          throw new Error(status.data.reason === "STALE_DEMO_STATE" ? "Tahap perangkat sudah berubah. Tunggu status terbaru, lalu coba lagi." : "Perintah belum diterapkan. Periksa koneksi dan status perangkat.");
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error("Konfirmasi ESP32 belum diterima. Periksa keadaan perangkat sebelum melanjutkan.");
    } catch (error) {
      if (generation === commandGeneration.current) setFeedback(error instanceof Error ? error.message : "Perintah gagal. Periksa perangkat.");
      return false;
    } finally {
      if (generation === commandGeneration.current) {
        commandRequest.current = null;
        setPending(null);
      }
    }
  }

  return { ready, step, paused: !!device?.demo_paused, pending, feedback, send };
}
export type DemoController = ReturnType<typeof useDemoController>;
