"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
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

interface PhChartProps {
  data: Array<{ time: string; ph: number | null }>;
  isDeviceOnline: boolean;
}

export function PhChart({ data, isDeviceOnline }: PhChartProps) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-sm font-semibold">Perubahan pH</CardTitle>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            pH
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        {data.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">Belum ada riwayat pH</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {isDeviceOnline
                ? "Grafik akan terisi setelah alat mengirim bacaan pertama."
                : "Alat sedang tidak terhubung. Grafik akan diperbarui setelah koneksi kembali."}
            </p>
          </div>
        ) : (
          <div className="h-72 w-full pt-6 pr-4 pb-2 sm:h-80 sm:pr-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                  className="opacity-60"
                />
                <XAxis
                  dataKey="time"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  yAxisId="ph"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  dx={-8}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    fontSize: "12px",
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-card-foreground)",
                  }}
                  itemStyle={{ color: "var(--color-foreground)", fontWeight: 500 }}
                  labelStyle={{ color: "var(--color-muted-foreground)", marginBottom: "4px" }}
                />
                <ReferenceLine
                  yAxisId="ph"
                  y={7.5}
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  opacity={0.65}
                  label={{
                    position: "insideTopLeft",
                    value: "Batas atas 7.5",
                    fill: "#92400e",
                    fontSize: 10,
                    dy: -10,
                  }}
                />
                <ReferenceLine
                  yAxisId="ph"
                  y={6.5}
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  opacity={0.65}
                />
                <Line
                  yAxisId="ph"
                  type="monotone"
                  dataKey="ph"
                  name="pH"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
