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

const SYSTEM_INSTRUCTION = `Kamu adalah pendamping petambak ikan yang menjelaskan kondisi kolam dengan bahasa sederhana.

Berikan saran singkat berdasarkan bacaan pH terbaru.

Aturan:
- Gunakan istilah "alat" dan "aliran cairan pengatur pH"
- Jika pH > 7.5, jelaskan bahwa pH di atas batas aman dan alat otomatis mulai mengatur aliran
- Jika pH < 6.5, jelaskan bahwa pH di bawah batas aman, aliran dihentikan, dan kondisi air perlu diperiksa
- Jika pH 6.5-7.5, sampaikan bahwa pH aman
- Berikan tindakan yang dapat langsung dilakukan

Format respons:
- Maksimal 3 kalimat pendek
- Bahasa Indonesia yang ramah dan langsung
- Jangan gunakan istilah telemetri, solenoid, relay, GPIO, MQTT, AUTO, atau MANUAL
- Tanpa JSON dan tanpa markdown`;

function buildUserPrompt(rows: SensorRow[]): string {
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

  return `Berikut ${rows.length} data sensor terbaru dari kolam (terbaru di atas):

${JSON.stringify(sensorJson, null, 2)}

Tren pH: ${trend}
pH terakhir: ${rows[0].ph_level ?? "tidak tersedia"}
Aturan alat: jika pH > 7.5 maka aliran cairan pengatur pH dimulai, lalu dihentikan setelah pH < 7.3

Analisis dan beri saran.`;
}

function parseRetryDelayMs(error: unknown): number {
  const fallbackMs = 60_000;
  if (!(error instanceof Error)) return fallbackMs;

  // Gemini SDK error string often includes: "Please retry in 40.10s"
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
    const pondId = searchParams.get("pondId");

    let result;
    if (pondId) {
      result = await pool.query<SensorRow>(
        `SELECT pond_id, temperature, do_level, ph_level, created_at
         FROM sensor_data
         WHERE device_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [parseInt(pondId, 10)],
      );
    } else {
      result = await pool.query<SensorRow>(
        `SELECT pond_id, temperature, do_level, ph_level, created_at
         FROM sensor_data
         WHERE device_id IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 20`,
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        insight:
          "Belum ada bacaan pH. Pastikan alat menyala dan sensor terpasang dengan baik.",
        source: "fallback",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      const insight = generateFallbackInsight(result.rows);
      return NextResponse.json({
        success: true,
        insight,
        source: "rule-based",
      });
    }

    if (Date.now() < geminiCooldownUntil) {
      const insight = generateFallbackInsight(result.rows);
      return NextResponse.json({
        success: true,
        insight,
        source: "rule-based",
      });
    }

    try {
      const userPrompt = buildUserPrompt(result.rows);
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

      const response = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          maxOutputTokens: 150,
          temperature: 0.3,
        },
      });

      const insight =
        response.text?.trim() || "Tidak dapat menghasilkan insight saat ini.";

      return NextResponse.json({
        success: true,
        insight,
        source: "ai",
      });
    } catch (error) {
      if (isQuotaError(error)) {
        const retryMs = parseRetryDelayMs(error);
        geminiCooldownUntil = Date.now() + retryMs;

        // Log once per 30s to avoid noisy repeated logs from polling cards.
        if (Date.now() - lastQuotaLogAt > 30_000) {
          console.warn(
            `[API /ai-insight] Gemini quota reached. Using rule-based fallback for ${Math.ceil(retryMs / 1000)}s.`,
          );
          lastQuotaLogAt = Date.now();
        }

        const insight = generateFallbackInsight(result.rows);
        return NextResponse.json({
          success: true,
          insight,
          source: "rule-based",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("[API /ai-insight] Error:", error);

    try {
      const { searchParams } = new URL(request.url);
      const pondId = searchParams.get("pondId");

      let result;
      if (pondId) {
        result = await pool.query<SensorRow>(
          `SELECT pond_id, temperature, do_level, ph_level, created_at
           FROM sensor_data
           WHERE device_id = $1
           ORDER BY created_at DESC
           LIMIT 20`,
          [parseInt(pondId, 10)],
        );
      } else {
        result = await pool.query<SensorRow>(
          `SELECT pond_id, temperature, do_level, ph_level, created_at
           FROM sensor_data
           WHERE device_id IS NOT NULL
           ORDER BY created_at DESC
           LIMIT 20`,
        );
      }
      const insight = generateFallbackInsight(result.rows);
      return NextResponse.json({
        success: true,
        insight,
        source: "rule-based",
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Gagal menghasilkan insight" },
        { status: 500 },
      );
    }
  }
}

function generateFallbackInsight(rows: SensorRow[]): string {
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
      "Belum ada bacaan pH. Pastikan alat menyala dan sensor terpasang dengan baik.",
    );
  } else if (latest.ph_level > 7.5) {
    parts.push(
      `pH saat ini ${latest.ph_level.toFixed(1)} dan berada di atas batas aman. Alat otomatis mengatur aliran cairan pengatur pH.`,
    );
  } else if (latest.ph_level < 6.5) {
    parts.push(
      `pH saat ini ${latest.ph_level.toFixed(1)} dan berada di bawah batas aman. Aliran dihentikan; periksa kondisi air.`,
    );
  } else {
    parts.push(
      `pH saat ini ${latest.ph_level.toFixed(1)} dan berada dalam rentang aman. Tidak ada tindakan tambahan saat ini.`,
    );
  }

  if (newerAvg < olderAvg - 0.1) {
    parts.push(
      `pH cenderung menurun. Pantau kembali agar tidak melewati batas aman.`,
    );
  } else if (newerAvg > olderAvg + 0.1) {
    parts.push(`Tren pH membaik. Pertahankan pemantauan rutin.`);
  } else {
    parts.push(`Tren pH stabil. Tidak perlu tindakan tambahan saat ini.`);
  }

  return parts.join(" ");
}
