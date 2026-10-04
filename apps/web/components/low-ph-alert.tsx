"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Siren, X } from "lucide-react";
import { nextLowPhAlert } from "@/lib/ph-alert";

function siren(context: AudioContext) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    oscillator.frequency.setValueAtTime(480, start);
    oscillator.frequency.linearRampToValueAtTime(960, start + 0.6);
    oscillator.frequency.linearRampToValueAtTime(480, start + 1.2);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.065, start + 0.05);
    gain.gain.setValueAtTime(0.065, start + 1.1);
    gain.gain.linearRampToValueAtTime(0, start + 1.25);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + 1.3);
  return () => { try { oscillator.stop(); } catch { /* Already ended. */ } };
}

export function LowPhAlert({ ph, timestamp, available, actionRequired, actionDisabled, pending, feedback, onRespond }: {
  ph: number | null;
  timestamp: string | null;
  available: boolean;
  actionRequired: boolean;
  actionDisabled: boolean;
  pending: boolean;
  feedback: string;
  onRespond: () => Promise<boolean>;
}) {
  const [active, setActive] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [responseAttempted, setResponseAttempted] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const needsAction = active && actionRequired;

  useEffect(() => {
    const update = () => {
      const age = timestamp ? Date.now() - Date.parse(timestamp) : Infinity;
      setActive((previous) => nextLowPhAlert(previous, ph, available && age >= -1000 && age < 5000));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [ph, timestamp, available]);

  useEffect(() => {
    let mounted = true;
    let audio: AudioContext;
    try { audio = new AudioContext(); } catch { return; }
    context.current = audio;
    const updateReady = () => { if (mounted) setAudioReady(audio.state === "running"); };
    const resume = () => { void audio.resume().then(updateReady).catch(() => {}); };
    audio.addEventListener("statechange", updateReady);
    // Autoplay when permitted; ordinary demo interactions unlock restricted browsers.
    document.addEventListener("pointerdown", resume, true);
    document.addEventListener("keydown", resume, true);
    resume();
    return () => {
      mounted = false;
      document.removeEventListener("pointerdown", resume, true);
      document.removeEventListener("keydown", resume, true);
      audio.removeEventListener("statechange", updateReady);
      if (context.current === audio) context.current = null;
      void audio.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!active || !audioReady) return;
    let stopBeep: (() => void) | undefined;
    const play = () => {
      if (context.current?.state === "running") stopBeep = siren(context.current);
    };
    play();
    const timer = setInterval(play, 1500);
    return () => { clearInterval(timer); stopBeep?.(); };
  }, [active, audioReady]);

  useEffect(() => {
    if (!active) { setDismissed(false); setResponseAttempted(false); }
  }, [active]);

  useEffect(() => {
    if (!needsAction || !dismissed || pending) return;
    const timer = setTimeout(() => setDismissed(false), 10000);
    return () => clearTimeout(timer);
  }, [needsAction, dismissed, pending]);

  useEffect(() => {
    const popup = dialog.current;
    if (!popup) return;
    const close = () => {
      if (!popup.open) return;
      popup.close();
      const target = opener.current;
      if (target?.isConnected && !target.matches(":disabled")) target.focus();
      else document.getElementById("expo-demo-controls")?.focus();
    };
    if (needsAction && !dismissed && !popup.open) {
      opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      popup.showModal();
    } else if (!needsAction || dismissed) close();
    return close;
  }, [needsAction, dismissed]);

  async function respond() {
    if (actionDisabled || !needsAction) return;
    setResponseAttempted(true);
    if (await onRespond()) setDismissed(true);
  }

  return (
    <>
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${active ? "border-red-200 bg-red-50 text-red-900" : "border-border bg-card text-muted-foreground"}`}>
      <div className="min-w-0 text-sm">
        <div role="status" aria-live="polite" className="flex items-center gap-2 font-medium">
          {active && <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          {active ? "Peringatan: pH air rendah" : "Peringatan pH rendah"}
        </div>
        <p className="mt-1 text-xs">
          {active ? actionRequired ? "pH melewati batas bawah 6,5. Buka valve melalui popup atau panel kontrol. Tanpa tindakan, popup akan muncul kembali." : "Respons demo sedang berlangsung. Sirene berhenti setelah pH pulih." : "Peringatan suara otomatis berbunyi saat pH di bawah 6,5."}
        </p>
      </div>
    </div>
    <dialog ref={dialog} role="alertdialog" aria-labelledby="low-ph-title" aria-describedby="low-ph-description"
      onCancel={(event) => { event.preventDefault(); setDismissed(true); }} className="expo-alert-dialog m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl bg-card p-0 text-foreground">
      <div className="relative overflow-hidden px-6 pb-6 pt-8 sm:px-8">
        <div className="expo-siren-lights pointer-events-none absolute inset-x-0 top-0 h-2" aria-hidden="true"><span /><span /></div>
        <button type="button" aria-label="Tutup popup peringatan" onClick={() => setDismissed(true)} className="absolute right-2 top-3 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" /></button>
        <div className="expo-siren-icon mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600" aria-hidden="true"><Siren className="h-10 w-10" /></div>
        <h2 id="low-ph-title" className="text-center text-2xl font-semibold text-red-800">pH air rendah!</h2>
        <p id="low-ph-description" className="mt-2 text-center text-sm text-muted-foreground">Buka valve demo selama 3 detik untuk memperagakan respons alat. Valve menutup otomatis, lalu pH simulasi pulih ke sekitar 7,5.</p>
        <p className="my-6 text-center text-4xl font-bold tabular-nums text-red-700" aria-label={`pH saat ini ${ph?.toFixed(2) ?? "tidak tersedia"}`}>{ph?.toFixed(2) ?? "--"}<span className="ml-2 text-sm font-medium text-muted-foreground">pH</span></p>
        <button type="button" disabled={actionDisabled || !needsAction} onClick={() => void respond()} className="min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Menunggu konfirmasi valve…" : "Buka valve demo · 3 detik"}</button>
        {(pending || responseAttempted) && <p role="status" aria-live="polite" className="mt-3 text-center text-xs text-red-800">{feedback}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">Jika ditutup tanpa tindakan, popup muncul lagi setelah 10 detik. Sirene tetap aktif sampai pH pulih atau demo dijeda.</p>
      </div>
    </dialog>
    </>
  );
}
