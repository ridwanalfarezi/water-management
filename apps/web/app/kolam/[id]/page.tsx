"use client";

import { DemoControls } from "@/components/demo-controls";
import { useDemoController, type DemoDevice } from "@/hooks/use-demo-controller";
import { LowPhAlert } from "@/components/low-ph-alert";
import { AIInsightCard } from "@/components/ai-insight-card";
import { AISummaryCard } from "@/components/ai-summary-card";
import { JournalForm } from "@/components/journal-form";
import { JournalList } from "@/components/journal-list";
import { PondSelector } from "@/components/pond-selector";
import { TechnicalDetails } from "@/components/technical-details";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getConnectionLabel,
  getFlowLabel,
  getModeLabel,
  getSignalLabel,
} from "@/lib/user-copy";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

interface PondSummary extends DemoDevice {
  pond_id: number;
  device_uid: string;
  last_seen_at: string;
  solenoid_state: "ON" | "OFF" | null;
  control_mode: "AUTO" | "MANUAL" | null;
  rssi: number | null;
  connection_status: "online" | "offline";
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
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
  const [allPondIds, setAllPondIds] = useState<number[]>([]);
  const [currentPond, setCurrentPond] = useState<PondSummary | null>(null);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data?pondId=${pondId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Data kolam belum tersedia");
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
      const res = await fetch("/api/ponds", { cache: "no-store" });
      if (!res.ok) throw new Error("Status perangkat belum tersedia");
      const json = await res.json();
      if (json.success) {
        const ponds = json.data as PondSummary[];
        setAllPondIds(ponds.map((p) => p.pond_id).sort((a, b) => a - b));
        setCurrentPond(ponds.find((p) => p.pond_id === pondId) ?? null);
      }
    } catch {
      setCurrentPond(null);
    }
  }, [pondId]);

  useEffect(() => {
    fetchData();
    fetchPondIds();
    const interval = setInterval(() => {
      fetchData();
      fetchPondIds();
    }, 500);
    return () => clearInterval(interval);
  }, [fetchData, fetchPondIds]);

  const chartData = [...data].reverse().map((item) => ({
    time: formatTime(item.created_at),
    ph: item.ph_level,
  }));

  const latestRecord = data.length > 0 ? data[0] : null;
  const isHighPH =
    latestRecord?.ph_level != null ? latestRecord.ph_level > 8.5 : false;
  const isLowPH =
    latestRecord?.ph_level != null ? latestRecord.ph_level < 6.5 : false;
  const currentSolenoidState = latestRecord?.solenoid_state ?? "OFF";
  const isDeviceOnline = currentPond?.connection_status === "online";
  const flowLabel = getFlowLabel(latestRecord?.solenoid_state ?? null);
  const modeLabel = getModeLabel(latestRecord?.control_mode ?? null);
  const signalLabel = getSignalLabel(latestRecord?.rssi ?? null);
  const controller = useDemoController({ device: currentPond, connected: isDeviceOnline && !error, pondId,
    onApplied: async () => { await Promise.all([fetchData(), fetchPondIds()]); } });
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
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/kolam"
              aria-label="Kembali ke semua kolam"
              className="flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white p-1">
              <Image
                src="/logo-pict.png"
                alt="KolamPintar Logo"
                width={24}
                height={24}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none tracking-tight text-primary-dark">
                Kolam {pondId}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {currentPond?.data_source === "SIMULATION" ? "Kondisi kolam · Data simulasi expo" : "Kondisi kolam saat ini"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
              <span className="relative flex h-2 w-2">
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

      <main className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        {/* Pond Selector */}
        {allPondIds.length > 1 && (
          <div className="mb-4">
            <PondSelector currentPondId={pondId} pondIds={allPondIds} />
          </div>
        )}

        {/* Connection Error */}
        {error && (
          <div className="mb-8 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
          <section aria-label="Kondisi kolam dan grafik pH" className="grid min-w-0 gap-4">
          {/* Top Section: Overview Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {currentPond?.data_source === "SIMULATION" ? "pH Air · Simulasi" : "pH Air"}
                </CardTitle>
                <FlaskConical
                  className={`h-4 w-4 ${isHighPH || isLowPH ? "text-amber-500" : "text-muted-foreground"}`}
                />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="flex items-baseline gap-1">
                  <div
                    className={`text-4xl font-bold tracking-tight tabular-nums ${isHighPH || isLowPH ? "text-amber-600" : "text-foreground"}`}
                  >
                    {latestRecord?.ph_level?.toFixed(2) ?? "--"}
                  </div>
                </div>
                {currentPond?.data_source === "SIMULATION" && latestRecord && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${isDeviceOnline && !error ? "bg-emerald-500" : "bg-zinc-400"}`} aria-hidden="true" />
                    Sampel simulasi · {formatTime(latestRecord.created_at)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Valve demo
                </CardTitle>
                <FlaskConical
                  className={`h-4 w-4 ${currentSolenoidState === "ON" ? "text-amber-500" : "text-muted-foreground"}`}
                />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold tracking-tight">
                  {flowLabel}
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    {modeLabel}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Kekuatan sinyal
                </CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                <div className="text-2xl font-bold tracking-tight">
                  {signalLabel}
                </div>
              </CardContent>
            </Card>
          </div>

          {currentPond?.data_source === "SIMULATION" && (
            <LowPhAlert key={pondId} ph={latestRecord?.ph_level ?? null} timestamp={latestRecord?.created_at ?? null}
              actionRequired={controller.step === "DANGER"} actionDisabled={!controller.ready || !!controller.pending}
              pending={!!controller.pending} feedback={controller.feedback}
              onRespond={() => controller.step === "DANGER" ? controller.send("NEXT") : Promise.resolve(false)}
              available={controller.ready && !controller.paused && ["FOOD", "DANGER", "ACTIVE", "RECOVERY"].includes(controller.step ?? "")} />
          )}

          {/* Middle Section: Chart */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 px-4 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Perubahan pH
                </CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground font-medium">
                      pH
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {chartData.length === 0 ? (
                <div className="flex h-60 xl:h-72 items-center justify-center text-sm text-muted-foreground">
                  Menunggu bacaan pH...
                </div>
              ) : (
                <div className="h-60 xl:h-72 w-full pt-3 pr-4 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        className="opacity-50"
                      />
                      <XAxis
                        dataKey="time"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis
                        yAxisId="ph"
                        domain={currentPond?.data_source === "SIMULATION" ? [5.8, 8.8] : ["auto", "auto"]}
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dx={-8}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          boxShadow:
                            "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                          fontSize: "12px",
                          backgroundColor: "var(--card)",
                          color: "var(--card-foreground)",
                        }}
                        itemStyle={{
                          color: "var(--foreground)",
                          fontWeight: 500,
                        }}
                        labelStyle={{
                          color: "var(--muted-foreground)",
                          marginBottom: "4px",
                        }}
                      />
                      <ReferenceLine yAxisId="ph" y={6.5} stroke="#ef4444" strokeDasharray="4 4" opacity={0.6}
                        label={{ position: "insideBottomLeft", value: "Batas bawah pH 6.5", fill: "#ef4444", fontSize: 10, dy: 12 }} />
                      <ReferenceLine
                        yAxisId="ph"
                        y={8.5}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        opacity={0.5}
                        label={{
                          position: "insideTopLeft",
                          value: "Batas atas pH 8.5",
                          fill: "#f59e0b",
                          fontSize: 10,
                          dy: -10,
                        }}
                      />
                      <Line
                        yAxisId="ph"
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="ph"
                        name="pH"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          </section>

          <aside aria-label="Panduan dan kontrol demo" className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
            <DemoControls controller={controller} />
          </aside>

          <section aria-label="Informasi tambahan kolam" className="grid min-w-0 gap-6 lg:col-start-1">
          <TechnicalDetails
            items={[
              { label: "ID perangkat", value: currentPond?.device_uid },
              {
                label: "Terakhir terhubung",
                value: currentPond?.last_seen_at
                  ? new Date(currentPond.last_seen_at).toLocaleString("id-ID")
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

          {/* AI Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            <AIInsightCard pondId={pondId} />
            <AISummaryCard pondId={pondId} />
          </div>

          {/* Journal Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <JournalForm
              pondId={pondId}
              onSaved={() => setJournalRefreshKey((k) => k + 1)}
            />
            <JournalList pondId={pondId} refreshKey={journalRefreshKey} />
          </div>

          {/* Supporting pH explanation */}
          <div>

            {/* Right: Alerts Panel */}
            <div className="flex flex-col justify-end">
              <div
                className={`overflow-hidden rounded-xl border p-5 shadow-sm transition-colors duration-300 ${
                  isHighPH || isLowPH
                    ? "bg-amber-50 border-amber-200"
                    : "bg-emerald-50 border-emerald-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 rounded-full p-1.5 ${
                      isHighPH || isLowPH
                        ? "bg-amber-100 text-amber-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}
                  >
                    {isHighPH || isLowPH ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-semibold ${
                        isHighPH || isLowPH ? "text-amber-800" : "text-emerald-800"
                      }`}
                    >
                      {isHighPH ? "pH Tinggi" : isLowPH ? "pH Rendah" : "pH Stabil"}
                    </h4>
                    <p
                      className={`mt-1 text-sm ${
                        isHighPH || isLowPH ? "text-amber-700" : "text-emerald-700"
                      }`}
                    >
                      {isHighPH
                        ? "Nilai pH simulasi berada di atas rentang normal. Ikuti tahap demo melalui panel kontrol."
                        : isLowPH
                          ? "Nilai pH simulasi berada di bawah rentang normal. Perangkat akan memperagakan respons valve pada tahap berikutnya."
                          : "Nilai pH berada dalam rentang normal. Perubahan pH pada demo merupakan simulasi dari perangkat."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </section>
        </div>
      </main>
    </div>
  );
}
