"use client";

import { AIInsightCard } from "@/components/ai-insight-card";
import { AISummaryCard } from "@/components/ai-summary-card";
import { JournalForm } from "@/components/journal-form";
import { JournalList } from "@/components/journal-list";
import { PondSelector } from "@/components/pond-selector";
import { TechnicalDetails } from "@/components/technical-details";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";
import {
  type CommandStatus,
  getCommandFeedbackCopy,
  getConnectionLabel,
  getControlRequestError,
  getFlowLabel,
  getModeLabel,
  getSignalLabel,
} from "@/lib/user-copy";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  Waves,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

const PhChart = dynamic(
  () => import("@/components/ph-chart").then((module) => module.PhChart),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-xl border bg-card sm:h-80" aria-label="Memuat grafik pH" />,
  },
);

interface SensorData {
  id: number;
  pond_id: number;
  temperature: number | null;
  do_level: number | null;
  ph_level: number | null;
  solenoid_state: "ON" | "OFF" | null;
  control_mode: "AUTO" | "MANUAL" | null;
  rssi: number | null;
  created_at: string;
}

interface PondSummary {
  pond_id: number;
  device_uid: string;
  last_seen_at: string;
  solenoid_state: "ON" | "OFF" | null;
  control_mode: "AUTO" | "MANUAL" | null;
  rssi: number | null;
  connection_status: "online" | "offline";
}

interface CommandFeedback {
  commandId: string;
  status: CommandStatus;
  requested: {
    mode: "AUTO" | "MANUAL" | null;
    solenoid: "ON" | "OFF" | null;
  };
  applied: {
    mode: "AUTO" | "MANUAL";
    solenoid: "ON" | "OFF";
    relayPinLevel: number;
  } | null;
  reason: string | null;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

export default function PondDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const pondId = parseInt(resolvedParams.id, 10);

  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlLoadingTarget, setControlLoadingTarget] = useState<
    string | null
  >(null);
  const [allPondIds, setAllPondIds] = useState<number[]>([]);
  const [currentPond, setCurrentPond] = useState<PondSummary | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [commandFeedback, setCommandFeedback] =
    useState<CommandFeedback | null>(null);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const commandPollGeneration = useRef(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data?pondId=${pondId}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError("Kondisi kolam belum dapat dimuat. Sistem akan mencoba lagi.");
      }
    } catch {
      setError("Koneksi sedang terganggu. Sistem akan mencoba lagi.");
    } finally {
      setLoading(false);
    }
  }, [pondId]);

  const fetchPondIds = useCallback(async () => {
    try {
      const res = await fetch("/api/ponds");
      const json = await res.json();
      if (json.success) {
        const ponds = json.data as PondSummary[];
        setAllPondIds(ponds.map((p) => p.pond_id).sort((a, b) => a - b));
        setCurrentPond(ponds.find((p) => p.pond_id === pondId) ?? null);
      }
    } catch {
      // fallback
    }
  }, [pondId]);

  useEffect(() => {
    fetchData();
    fetchPondIds();
    const interval = setInterval(() => {
      fetchData();
      fetchPondIds();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchPondIds]);

  useEffect(() => {
    commandPollGeneration.current += 1;
    setCommandFeedback(null);
    setControlLoadingTarget(null);
    return () => {
      commandPollGeneration.current += 1;
    };
  }, [pondId]);

  const pollCommandStatus = useCallback(
    async (commandId: string, generation: number) => {
      const pollingDeadline = Date.now() + 35_000;

      while (
        commandPollGeneration.current === generation &&
        Date.now() < pollingDeadline
      ) {
        try {
          const response = await fetch(`/api/control/${commandId}`, {
            cache: "no-store",
          });
          const json = await response.json();
          if (!response.ok || !json.success) {
            throw new Error(json.error || "Gagal membaca status command");
          }

          const feedback = json.data as CommandFeedback;
          setCommandFeedback(feedback);

          if (feedback.status === "PENDING" || feedback.status === "SENT") {
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          setControlLoadingTarget(null);
          if (feedback.status === "TIMED_OUT") {
            await new Promise((resolve) => setTimeout(resolve, 2_000));
            continue;
          }

          if (
            feedback.status === "APPLIED" ||
            feedback.status === "APPLIED_LATE"
          ) {
            await Promise.all([fetchData(), fetchPondIds()]);
          }
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1_000));
        }
      }

      if (commandPollGeneration.current === generation) {
        setControlLoadingTarget(null);
        setCommandFeedback((current) =>
          current?.commandId === commandId &&
          (current.status === "PENDING" || current.status === "SENT")
            ? { ...current, status: "TIMED_OUT" }
            : current,
        );
      }
    },
    [fetchData, fetchPondIds],
  );

  const sendControl = async (value: "AUTO" | "ON" | "OFF") => {
    const generation = commandPollGeneration.current + 1;
    commandPollGeneration.current = generation;
    setControlLoadingTarget(value);
    setControlError(null);
    setCommandFeedback(null);
    try {
      const res = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          value === "AUTO" ? { pondId, mode: "AUTO" } : { pondId, solenoid: value },
        ),
      });
      const json = await res.json();
      if (json.success) {
        const requestedMode = value === "AUTO" ? "AUTO" : "MANUAL";
        setCommandFeedback({
          commandId: json.commandId,
          status: json.status,
          requested: {
            mode: requestedMode,
            solenoid: value === "AUTO" ? null : value,
          },
          applied: null,
          reason: null,
        });
        void pollCommandStatus(json.commandId, generation);
      } else if (json.commandId && json.status === "PUBLISH_FAILED") {
        setControlLoadingTarget(null);
        setCommandFeedback({
          commandId: json.commandId,
          status: "PUBLISH_FAILED",
          requested: {
            mode: value === "AUTO" ? "AUTO" : "MANUAL",
            solenoid: value === "AUTO" ? null : value,
          },
          applied: null,
          reason: json.reason || json.error || "Pengiriman ke broker gagal",
        });
      } else {
        setControlLoadingTarget(null);
        setControlError(getControlRequestError(res.status, json.error));
      }
    } catch {
      setControlLoadingTarget(null);
      setControlError("Koneksi sedang terganggu. Coba kirim pengaturan lagi.");
    }
  };

  const chartData = [...data].reverse().map((item) => ({
    time: formatTime(item.created_at),
    ph: item.ph_level,
  }));

  const latestRecord = data.length > 0 ? data[0] : null;
  const currentPh = latestRecord?.ph_level ?? null;
  const hasPhReading = currentPh !== null;
  const isHighPH = currentPh !== null ? currentPh > 7.5 : false;
  const isLowPH = currentPh !== null ? currentPh < 6.5 : false;
  const currentSolenoidState = latestRecord?.solenoid_state ?? null;
  const currentControlMode = latestRecord?.control_mode ?? null;
  const isDeviceOnline = currentPond?.connection_status === "online";
  const flowLabel = getFlowLabel(latestRecord?.solenoid_state ?? null);
  const modeLabel = getModeLabel(latestRecord?.control_mode ?? null);
  const signalLabel = getSignalLabel(latestRecord?.rssi ?? null);
  const commandCopy = commandFeedback
    ? getCommandFeedbackCopy(
        commandFeedback.status,
        commandFeedback.applied?.solenoid ?? null,
      )
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true">
        <div className="border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-md bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-5xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
          <div className="h-52 animate-pulse rounded-xl border bg-card" />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl border bg-card" />
            <div className="h-40 animate-pulse rounded-xl border bg-card" />
          </div>
          <span className="sr-only">Sedang mengambil kondisi kolam...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/kolam"
              aria-label="Kembali ke semua kolam"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white p-1 sm:flex">
              <Image
                src="/logo-pict.png"
                alt="KolamPintar Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-none tracking-tight text-primary-dark">
                Kolam {pondId}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Kondisi kolam saat ini
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div role="status" aria-live="polite" className="flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                {isDeviceOnline && !error && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${error || !isDeviceOnline ? "bg-destructive" : "bg-success"}`}
                ></span>
              </span>
              {error || !isDeviceOnline
                ? "Alat tidak terhubung"
                : "Alat terhubung"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        {/* Pond Selector */}
        {allPondIds.length > 1 && (
          <div className="mb-6">
            <PondSelector currentPondId={pondId} pondIds={allPondIds} />
          </div>
        )}

        {/* Connection Error */}
        {error && (
          <div role="alert" className="mb-6 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void Promise.all([fetchData(), fetchPondIds()])}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Coba lagi
            </button>
          </div>
        )}

        <div className="grid gap-6">
          <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="pond-status-title">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FlaskConical className="h-4 w-4" aria-hidden="true" />
                  <h2 id="pond-status-title">pH air saat ini</h2>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-4xl font-bold tracking-tight ${isHighPH || isLowPH ? "text-amber-700" : "text-foreground"}`}>
                    {currentPh?.toFixed(2) ?? "--"}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">pH</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${!hasPhReading ? "bg-sky-100 text-sky-800" : isHighPH || isLowPH ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  <span className={`h-2 w-2 rounded-full ${!hasPhReading ? "bg-sky-500" : isHighPH || isLowPH ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />
                  {!hasPhReading ? "Menunggu bacaan" : isHighPH || isLowPH ? "Perlu diperiksa" : "Dalam rentang aman"}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {latestRecord ? `Diperbarui pukul ${formatTime(latestRecord.created_at)}` : "Belum ada waktu pembacaan"}
                </span>
              </div>
            </div>
            <dl className="grid border-t sm:grid-cols-3 sm:divide-x">
              <div className="flex items-center gap-3 border-b p-4 last:border-b-0 sm:border-b-0 sm:p-5">
                <Waves className={`h-5 w-5 shrink-0 ${currentSolenoidState === "ON" ? "text-amber-700" : "text-muted-foreground"}`} aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Aliran pengatur pH</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">{flowLabel}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3 border-b p-4 last:border-b-0 sm:border-b-0 sm:p-5">
                <SlidersHorizontal className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Mode kendali</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">{modeLabel}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 sm:p-5">
                <Wifi className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Kekuatan sinyal</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-foreground">{signalLabel}</dd>
                </div>
              </div>
            </dl>
          </section>

          <TechnicalDetails
            items={[
              { label: "ID perangkat", value: currentPond?.device_uid },
              {
                label: "Terakhir terhubung",
                value: currentPond?.last_seen_at
                  ? new Date(currentPond.last_seen_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })
                  : null,
              },
              { label: "Mode sistem", value: currentPond?.control_mode },
              {
                label: "Kekuatan sinyal",
                value:
                  currentPond?.rssi != null ? `${currentPond.rssi} dBm` : null,
              },
              { label: "Status solenoid", value: currentPond?.solenoid_state },
              {
                label: "Status koneksi",
                value: currentPond
                  ? getConnectionLabel(currentPond.connection_status)
                  : null,
              },
            ]}
          />

          <PhChart data={chartData} isDeviceOnline={isDeviceOnline} />

          {/* Primary controls and operational guidance */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Flow Control */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Kendali aliran pengatur pH
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Perubahan baru dianggap berhasil setelah alat mengirim konfirmasi.
                </p>
              </CardHeader>
              <CardContent>
                <dl className="mb-4 grid grid-cols-2 divide-x rounded-lg bg-muted/70 py-3">
                  <div className="px-3">
                    <dt className="text-xs text-muted-foreground">Mode saat ini</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{modeLabel}</dd>
                  </div>
                  <div className="px-3">
                    <dt className="text-xs text-muted-foreground">Aliran saat ini</dt>
                    <dd className="mt-0.5 text-sm font-semibold">{flowLabel}</dd>
                  </div>
                </dl>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => sendControl("AUTO")}
                    disabled={!isDeviceOnline || controlLoadingTarget !== null || currentControlMode === "AUTO"}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-zinc-300 disabled:text-zinc-600"
                  >
                    Aktifkan otomatis
                  </button>
                  <button
                    type="button"
                    onClick={() => sendControl("ON")}
                    disabled={
                      controlLoadingTarget !== null ||
                      !isDeviceOnline ||
                      (currentControlMode === "MANUAL" && currentSolenoidState === "ON")
                    }
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-amber-100 disabled:text-amber-900"
                  >
                    <FlaskConical className="h-4 w-4" aria-hidden="true" />
                    Mulai aliran
                  </button>
                  <button
                    type="button"
                    onClick={() => sendControl("OFF")}
                    disabled={
                      controlLoadingTarget !== null ||
                      !isDeviceOnline ||
                      (currentControlMode === "MANUAL" && currentSolenoidState === "OFF")
                    }
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-zinc-100 disabled:text-zinc-500"
                  >
                    Hentikan aliran
                  </button>
                </div>

                <div aria-live="polite" aria-atomic="true" role="status">
                  {controlLoadingTarget !== null && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Sedang menerapkan pengaturan...
                    </div>
                  )}
                  {commandFeedback && commandCopy && (
                      <div
                        className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                          commandCopy.tone === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : commandCopy.tone === "warning"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-destructive/20 bg-destructive/10 text-destructive"
                        }`}
                      >
                        <p>{commandCopy.message}</p>
                        <div className="mt-2 border-t border-current/10 pt-2">
                          <TechnicalDetails
                            summary="Lihat detail pengiriman"
                            items={[
                              {
                                label: "ID pengaturan",
                                value: commandFeedback.commandId,
                              },
                              { label: "Status ACK", value: commandFeedback.status },
                              {
                                label: "Alasan teknis",
                                value: commandFeedback.reason,
                              },
                              {
                                label: "Level GPIO",
                                value: commandFeedback.applied?.relayPinLevel,
                              },
                            ]}
                          />
                        </div>
                      </div>
                    )}
                </div>
                {!isDeviceOnline && (
                  <p className="mt-3 rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                    Pengaturan belum dapat digunakan karena alat tidak terhubung.
                  </p>
                )}
                {controlError && (
                  <p role="alert" className="mt-3 text-center text-xs text-destructive">
                    {controlError}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Right: Alerts Panel */}
            <div className="flex flex-col justify-end">
              <div
                className={`overflow-hidden rounded-xl border p-5 transition-colors duration-200 ${
                  !hasPhReading
                    ? "border-sky-200 bg-sky-50"
                    : isHighPH || isLowPH
                    ? "bg-amber-50 border-amber-200"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 rounded-full p-1.5 ${
                      !hasPhReading
                        ? "bg-sky-100 text-sky-700"
                        : isHighPH || isLowPH
                        ? "bg-amber-100 text-amber-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {!hasPhReading ? (
                      <Activity className="h-5 w-5" aria-hidden="true" />
                    ) : isHighPH || isLowPH ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-semibold ${
                        !hasPhReading ? "text-sky-900" : isHighPH || isLowPH ? "text-amber-800" : "text-emerald-800"
                      }`}
                    >
                      {!hasPhReading ? "Menunggu bacaan pH" : isHighPH ? "pH tinggi" : isLowPH ? "pH rendah" : "pH stabil"}
                    </h4>
                    <p
                      className={`mt-1 text-sm ${
                        !hasPhReading ? "text-sky-800" : isHighPH || isLowPH ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {!hasPhReading
                        ? isDeviceOnline
                          ? "Alat terhubung, tetapi belum mengirim bacaan. Tunggu pembaruan berikutnya sebelum mengambil tindakan."
                          : "Alat tidak terhubung dan kondisi air belum dapat dipastikan. Periksa alat di kolam."
                        : isHighPH
                        ? "pH berada di atas batas aman. Dalam mode otomatis, alat mengatur aliran cairan untuk menurunkannya. Pantau perubahan pH secara berkala."
                        : isLowPH
                          ? "pH berada di bawah batas aman. Aliran cairan dihentikan. Periksa kondisi air sebelum melakukan tindakan berikutnya."
                          : "pH berada dalam rentang aman. Alat tetap memantau kondisi kolam secara otomatis."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section aria-labelledby="journal-title">
            <div className="mb-3">
              <h2 id="journal-title" className="text-base font-semibold">Riwayat kegiatan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Catat tindakan yang dapat menjelaskan perubahan kondisi air.</p>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card md:grid md:grid-cols-2 md:divide-x">
              <JournalForm
                pondId={pondId}
                onSaved={() => setJournalRefreshKey((k) => k + 1)}
              />
              <div className="border-t md:border-t-0">
                <JournalList pondId={pondId} refreshKey={journalRefreshKey} />
              </div>
            </div>
          </section>

          <section aria-labelledby="analysis-title">
            <div className="mb-3">
              <h2 id="analysis-title" className="text-base font-semibold">Analisis pendukung</h2>
              <p className="mt-1 text-sm text-muted-foreground">Gunakan rangkuman ini sebagai konteks tambahan; status alat dan bacaan pH di atas tetap menjadi acuan utama.</p>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card md:grid md:grid-cols-2 md:divide-x">
              <AIInsightCard pondId={pondId} />
              <div className="border-t md:border-t-0">
                <AISummaryCard pondId={pondId} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
