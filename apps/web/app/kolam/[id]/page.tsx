"use client";

import { AIInsightCard } from "@/components/ai-insight-card";
import { AISummaryCard } from "@/components/ai-summary-card";
import { JournalForm } from "@/components/journal-form";
import { JournalList } from "@/components/journal-list";
import { PondSelector } from "@/components/pond-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [lastPollAt, setLastPollAt] = useState(0);
  const [controlLoadingTarget, setControlLoadingTarget] = useState<
    string | null
  >(null);
  const [allPondIds, setAllPondIds] = useState<number[]>([]);
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data?pondId=${pondId}`);
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setLastPollAt(Date.now());
        setError(null);
      } else {
        setError(json.error || "Gagal mengambil data");
      }
    } catch {
      setError("Koneksi terputus — mencoba ulang...");
    } finally {
      setLoading(false);
    }
  }, [pondId]);

  const fetchPondIds = useCallback(async () => {
    try {
      const res = await fetch("/api/ponds");
      const json = await res.json();
      if (json.success) {
        setAllPondIds(
          json.data.map((p: { pond_id: number }) => p.pond_id).sort(),
        );
      }
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchPondIds();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchPondIds]);

  const sendControl = async (value: "AUTO" | "ON" | "OFF") => {
    setControlLoadingTarget(value);
    try {
      const res = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          value === "AUTO" ? { pondId, mode: "AUTO" } : { pondId, solenoid: value },
        ),
      });
      const json = await res.json();
      if (json.success) await fetchData();
    } catch {
      console.error("Gagal mengirim perintah kontrol");
    } finally {
      setControlLoadingTarget(null);
    }
  };

  const chartData = [...data].reverse().map((item) => ({
    time: formatTime(item.created_at),
    ph: item.ph_level,
  }));

  const latestRecord = data.length > 0 ? data[0] : null;
  const isHighPH =
    latestRecord?.ph_level != null ? latestRecord.ph_level > 7.5 : false;
  const isLowPH =
    latestRecord?.ph_level != null ? latestRecord.ph_level < 6.5 : false;
  const currentSolenoidState = latestRecord?.solenoid_state ?? "OFF";
  const currentControlMode = latestRecord?.control_mode ?? "AUTO";
  const isDeviceOnline =
    latestRecord !== null &&
    lastPollAt - new Date(latestRecord.created_at).getTime() < 15000;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-8 w-8 animate-pulse text-muted-foreground/50" />
          <p className="text-sm font-medium">Menghubungkan ke telemetri...</p>
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
            <Link
              href="/kolam"
              className="flex h-8 w-8 items-center justify-center rounded-md border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
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
                Telemetri Detail
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error || !isDeviceOnline ? "bg-destructive" : "bg-success"}`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${error || !isDeviceOnline ? "bg-destructive" : "bg-success"}`}
                ></span>
              </span>
              {error || !isDeviceOnline ? "Perangkat Offline" : "Perangkat Online"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-8">
        {/* Pond Selector */}
        {allPondIds.length > 1 && (
          <div className="mb-6">
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

        <div className="grid gap-6">
          {/* Top Section: Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  pH Air
                </CardTitle>
                <FlaskConical
                  className={`h-4 w-4 ${isHighPH || isLowPH ? "text-amber-500" : "text-muted-foreground"}`}
                />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <div
                    className={`text-2xl font-bold tracking-tight ${isHighPH || isLowPH ? "text-amber-600" : "text-foreground"}`}
                  >
                    {latestRecord?.ph_level?.toFixed(2) ?? "--"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status Solenoid
                </CardTitle>
                <FlaskConical
                  className={`h-4 w-4 ${currentSolenoidState === "ON" ? "text-amber-500" : "text-muted-foreground"}`}
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {currentSolenoidState === "ON" ? "NYALA" : "MATI"}
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    {currentControlMode}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sinyal Wi-Fi
                </CardTitle>
                <Wifi className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {latestRecord?.rssi != null ? `${latestRecord.rssi} dBm` : "--"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Section: Chart */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  Tren Kualitas Air
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
                <div className="flex h-87.5 items-center justify-center text-sm text-muted-foreground">
                  Menunggu telemetri...
                </div>
              ) : (
                <div className="h-87.5 w-full pt-6 pr-6 pb-2">
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
                      <ReferenceLine
                        yAxisId="ph"
                        y={7.5}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        opacity={0.5}
                        label={{
                          position: "insideTopLeft",
                          value: "Batas Solenoid (pH 7.5)",
                          fill: "#f59e0b",
                          fontSize: 10,
                          dy: -10,
                        }}
                      />
                      <Line
                        yAxisId="ph"
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

          {/* Bottom Section: Controls & Alerts */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Solenoid Control */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Kontrol Solenoid Asam
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Mode otomatis membuka solenoid di atas pH 7.5 dan menutupnya di bawah pH 7.3.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => sendControl("AUTO")}
                    disabled={controlLoadingTarget !== null || currentControlMode === "AUTO"}
                    className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                  >
                    Otomatis
                  </button>
                  <button
                    type="button"
                    onClick={() => sendControl("ON")}
                    disabled={
                      controlLoadingTarget !== null ||
                      (currentControlMode === "MANUAL" && currentSolenoidState === "ON")
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <FlaskConical className="h-4 w-4" />
                    Buka
                  </button>
                  <button
                    type="button"
                    onClick={() => sendControl("OFF")}
                    disabled={
                      controlLoadingTarget !== null ||
                      (currentControlMode === "MANUAL" && currentSolenoidState === "OFF")
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    Tutup
                  </button>
                </div>

                {controlLoadingTarget !== null && (
                  <p className="mt-3 text-xs text-muted-foreground animate-pulse text-center">
                    Mengirim perintah ke perangkat...
                  </p>
                )}
              </CardContent>
            </Card>

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
                        ? "pH berada di atas 7.5. Dalam mode otomatis, ESP32 membuka solenoid untuk menurunkan pH sampai di bawah 7.3."
                        : isLowPH
                          ? "pH berada di bawah 6.5. Solenoid asam harus tetap tertutup; periksa kondisi air secara manual."
                          : "pH berada dalam rentang aman. Solenoid tetap siaga dalam mode otomatis."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
