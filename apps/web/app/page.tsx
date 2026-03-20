"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Thermometer, Fan, Droplets, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIInsightCard } from "@/components/ai-insight-card";

interface SensorData {
  id: number;
  pond_id: number;
  temperature: number;
  do_level: number;
  created_at: string;
}

export default function Dashboard() {
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlLoading, setControlLoading] = useState(false);
  const [aeratorStatus, setAeratorStatus] = useState<"ON" | "OFF" | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/data");
      const json = await res.json();

      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || "Failed to fetch data");
      }
    } catch {
      setError("Connection error — retrying...");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const sendControl = async (aerator: "ON" | "OFF") => {
    setControlLoading(true);
    try {
      const res = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pondId: 1, aerator }),
      });
      const json = await res.json();
      if (json.success) {
        setAeratorStatus(aerator);
      }
    } catch {
      console.error("Failed to send control command");
    } finally {
      setControlLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const chartData = [...data].reverse().map((item) => ({
    time: formatTime(item.created_at),
    temperature: item.temperature,
    do: item.do_level,
  }));

  const latestRecord = data.length > 0 ? data[0] : null;
  const isLowDO = latestRecord ? latestRecord.do_level < 3 : false;
  const currentAeratorState = aeratorStatus || (isLowDO ? "ON" : "OFF");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Activity className="h-8 w-8 animate-pulse text-muted-foreground/50" />
          <p className="text-sm font-medium">Connecting to telemetry...</p>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Droplets className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none tracking-tight">
                AquaMonitor
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Pond Telemetry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
              <span className={`relative flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? "bg-destructive" : "bg-success"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? "bg-destructive" : "bg-success"}`}></span>
              </span>
              {error ? "Offline" : "Live"}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-8">
        
        {/* Connection Error */}
        {error && (
          <div className="mb-8 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-3">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-6">
          {/* Top Section: Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dissolved Oxygen
                </CardTitle>
                <Droplets className={`h-4 w-4 ${isLowDO ? "text-destructive" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <div className={`text-2xl font-bold tracking-tight ${isLowDO ? "text-destructive" : "text-foreground"}`}>
                    {latestRecord?.do_level.toFixed(2) ?? "--"}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">mg/L</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Temperature
                </CardTitle>
                <Thermometer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <div className="text-2xl font-bold tracking-tight">
                    {latestRecord?.temperature.toFixed(1) ?? "--"}
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">°C</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Aerator Status
                </CardTitle>
                <Fan className={`h-4 w-4 ${currentAeratorState === "ON" ? "animate-spin text-success" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {currentAeratorState}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Data Points
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {data.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Section: Chart */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Water Quality Trends</CardTitle>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                    <span className="text-muted-foreground font-medium">DO Level</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <span className="text-muted-foreground font-medium">Temperature</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {chartData.length === 0 ? (
                <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                  Awaiting telemetry...
                </div>
              ) : (
                <div className="h-[350px] w-full pt-6 pr-6 pb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" className="opacity-50" />
                      <XAxis 
                        dataKey="time" 
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        yAxisId="do"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dx={-8}
                      />
                      <YAxis 
                        yAxisId="temp"
                        orientation="right"
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        dx={8}
                        hide
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          backgroundColor: 'var(--card)',
                          color: 'var(--card-foreground)'
                        }}
                        itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }}
                        labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px' }}
                      />
                      <ReferenceLine 
                        yAxisId="do"
                        y={3} 
                        stroke="var(--destructive)" 
                        strokeDasharray="4 4" 
                        opacity={0.5}
                        label={{ position: 'insideTopLeft', value: 'Critical DO (3.0)', fill: 'var(--destructive)', fontSize: 10, dy: -10 }}
                      />
                      <Line 
                        yAxisId="do"
                        type="monotone" 
                        dataKey="do" 
                        name="DO (mg/L)"
                        stroke="currentColor" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, className: "fill-foreground" }}
                        className="text-foreground"
                      />
                      <Line 
                        yAxisId="temp"
                        type="monotone" 
                        dataKey="temperature" 
                        name="Temp (°C)"
                        stroke="currentColor" 
                        strokeWidth={2}
                        dot={false}
                        className="text-muted-foreground opacity-30"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Insight */}
          <AIInsightCard />

          {/* Bottom Section: Controls & Alerts */}
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Left: Manual Control */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Aerator Control</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Manual override for pond oxygenation.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => sendControl("ON")}
                    disabled={controlLoading || currentAeratorState === "ON"}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    <Fan className="h-4 w-4" />
                    Turn ON
                  </button>
                  <button
                    onClick={() => sendControl("OFF")}
                    disabled={controlLoading || currentAeratorState === "OFF"}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    Turn OFF
                  </button>
                </div>
                
                {controlLoading && (
                  <p className="mt-3 text-xs text-muted-foreground animate-pulse text-center">
                    Sending command to device...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Right: Alerts Panel */}
            <div className="flex flex-col justify-end">
              <div className={`overflow-hidden rounded-xl border p-5 shadow-sm transition-colors duration-300 ${
                isLowDO 
                  ? "bg-destructive-bg border-destructive/20" 
                  : "bg-success-bg border-success/20"
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 rounded-full p-1.5 ${
                    isLowDO ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                  }`}>
                    {isLowDO ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold ${
                      isLowDO ? "text-destructive-foreground" : "text-success-foreground"
                    }`}>
                      {isLowDO ? "Critical Oxygen Level" : "System Normal"}
                    </h4>
                    <p className={`mt-1 text-sm ${
                      isLowDO ? "text-destructive" : "text-success-foreground/80"
                    }`}>
                      {isLowDO 
                        ? "Oxygen level has dropped below the critical threshold (3.0 mg/L). The aerator has been automatically activated to restore safe levels." 
                        : "All water quality metrics are within normal operating ranges. The automated system is actively monitoring conditions."
                      }
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
