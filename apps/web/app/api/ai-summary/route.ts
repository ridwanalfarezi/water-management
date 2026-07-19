import pool from "@/lib/db";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let geminiCooldownUntil = 0;
let lastQuotaLogAt = 0;

interface SensorRow {
  pond_id: number;
  temperature: number | null;
  do_level: number | null;
  ph_level: number | null;
  created_at: Date;
}

const SYSTEM_INSTRUCTION = `Kamu adalah pendamping petambak ikan yang merangkum kondisi kolam dengan bahasa sederhana.

Aturan:
- Gunakan istilah "alat" dan "aliran cairan pengatur pH"
- Jika pH > 7.5, jelaskan bahwa pH di atas batas aman dan alat otomatis mulai mengatur aliran
- Jika pH < 6.5, jelaskan bahwa pH di bawah batas aman, aliran dihentikan, dan kondisi air perlu diperiksa
- Jika pH 6.5-7.5, jelaskan bahwa pH aman
- Berikan tindakan yang dapat langsung dilakukan

Format respons:
- Maksimal 2-3 kalimat pendek
- Bahasa Indonesia yang ramah dan langsung
- Jangan gunakan istilah telemetri, solenoid, relay, GPIO, MQTT, AUTO, atau MANUAL
- Tanpa JSON dan tanpa markdown`;

function buildUserPrompt(rows: SensorRow[], pondId: number): string {
  const sensorJson = rows.map((r) => ({
    ph: r.ph_level,
    waktu: new Date(r.created_at).toISOString(),
  }));

  const phValues = rows
    .map((r) => r.ph_level)
    .filter((value): value is number => value !== null);

  const midpoint = Math.floor(phValues.length / 2);
  const olderAvg =
    phValues.slice(midpoint).reduce((a, b) => a + b, 0) /
    (phValues.length - midpoint || 1);
  const newerAvg =
    phValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / (midpoint || 1);
  const trend =
    newerAvg < olderAvg - 0.1
      ? "menurun"
      : newerAvg > olderAvg + 0.1
        ? "meningkat"
        : "stabil";

  return `Berikut ${rows.length} data sensor terbaru dari Kolam ${pondId} (terbaru di atas):

${JSON.stringify(sensorJson, null, 2)}

Tren pH: ${trend}
pH terakhir: ${rows[0].ph_level ?? "tidak tersedia"}
Aturan alat: pH > 7.5 memulai aliran cairan pengatur pH; pH < 7.3 menghentikan aliran

Berikan ringkasan kondisi harian dalam 2-3 kalimat bahasa Indonesia.`;
}

function parseRetryDelayMs(error: unknown): number {
  const fallbackMs = 60_000;
  if (!(error instanceof Error)) return fallbackMs;

  const retryMatch = error.message.match(/retry in\s+([\d.]+)s/i);
  if (!retryMatch) return fallbackMs;

  const seconds = Number.parseFloat(retryMatch[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackMs;
  return Math.ceil(seconds * 1000);
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("resource_exhausted") ||
    msg.includes("status: 429")
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pondId = parseInt(searchParams.get("pondId") || "1", 10);

    const result = await pool.query<SensorRow>(
      `SELECT pond_id, temperature, do_level, ph_level, created_at
       FROM sensor_data
       WHERE device_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [pondId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        summary:
          "Belum ada bacaan pH. Pastikan alat menyala dan sensor terpasang dengan baik.",
        source: "fallback",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      const summary = generateFallbackSummary(result.rows, pondId);
      return NextResponse.json({
        success: true,
        summary,
        source: "rule-based",
      });
    }

    if (Date.now() < geminiCooldownUntil) {
      const summary = generateFallbackSummary(result.rows, pondId);
      return NextResponse.json({
        success: true,
        summary,
        source: "rule-based",
      });
    }

    try {
      const userPrompt = buildUserPrompt(result.rows, pondId);
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: 200,
          temperature: 0.3,
        },
      });

      const summary =
        response.text?.trim() || "Tidak dapat menghasilkan ringkasan saat ini.";

      return NextResponse.json({
        success: true,
        summary,
        source: "ai",
      });
    } catch (error) {
      if (isQuotaError(error)) {
        const retryMs = parseRetryDelayMs(error);
        geminiCooldownUntil = Date.now() + retryMs;

        if (Date.now() - lastQuotaLogAt > 30_000) {
          console.warn(
            `[API /ai-summary] Gemini quota reached. Using rule-based fallback for ${Math.ceil(retryMs / 1000)}s.`,
          );
          lastQuotaLogAt = Date.now();
        }

        const summary = generateFallbackSummary(result.rows, pondId);
        return NextResponse.json({
          success: true,
          summary,
          source: "rule-based",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("[API /ai-summary] Error:", error);

    try {
      const { searchParams } = new URL(request.url);
      const pondId = parseInt(searchParams.get("pondId") || "1", 10);
      const result = await pool.query<SensorRow>(
        `SELECT pond_id, temperature, do_level, ph_level, created_at
         FROM sensor_data
         WHERE device_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [pondId],
      );
      const summary = generateFallbackSummary(result.rows, pondId);
      return NextResponse.json({
        success: true,
        summary,
        source: "rule-based",
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Gagal menghasilkan ringkasan" },
        { status: 500 },
      );
    }
  }
}

function generateFallbackSummary(rows: SensorRow[], pondId: number): string {
  if (rows.length === 0) return "Belum ada bacaan pH untuk kolam ini.";

  const latest = rows[0];
  const phValues = rows
    .map((r) => r.ph_level)
    .filter((value): value is number => value !== null);

  const midpoint = Math.floor(phValues.length / 2);
  const olderAvg =
    phValues.slice(midpoint).reduce((a, b) => a + b, 0) /
    (phValues.length - midpoint || 1);
  const newerAvg =
    phValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / (midpoint || 1);

  const parts: string[] = [];

  if (latest.ph_level === null) {
    parts.push(
      `Belum ada bacaan pH untuk Kolam ${pondId}. Pastikan alat menyala dan sensor terpasang dengan baik.`,
    );
  } else if (latest.ph_level > 7.5) {
    parts.push(
      `pH Kolam ${pondId} berada di atas batas aman, yaitu ${latest.ph_level.toFixed(1)}. Alat otomatis mengatur aliran cairan pengatur pH.`,
    );
  } else if (latest.ph_level < 6.5) {
    parts.push(
      `pH Kolam ${pondId} berada di bawah batas aman, yaitu ${latest.ph_level.toFixed(1)}. Aliran dihentikan dan kondisi air perlu diperiksa.`,
    );
  } else {
    parts.push(
      `Kondisi Kolam ${pondId} stabil dengan pH ${latest.ph_level.toFixed(1)} dalam rentang aman.`,
    );
  }

  if (newerAvg < olderAvg - 0.1) {
    parts.push(
      `Tren pH cenderung menurun, jadi pemantauan perlu ditingkatkan.`,
    );
  } else if (newerAvg > olderAvg + 0.1) {
    parts.push(`Tren pH membaik.`);
  }

  return parts.join(" ");
}
