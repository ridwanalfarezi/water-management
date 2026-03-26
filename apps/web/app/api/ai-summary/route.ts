import pool from "@/lib/db";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let geminiCooldownUntil = 0;
let lastQuotaLogAt = 0;

interface SensorRow {
  pond_id: number;
  temperature: number;
  do_level: number;
  ph_level: number | null;
  created_at: Date;
}

const SYSTEM_INSTRUCTION = `Kamu adalah asisten AI ahli akuakultur.

Kamu diberikan data kualitas air terbaru dari kolam ikan. Tugasmu adalah menganalisis data dan memberikan ringkasan kondisi kolam dalam bahasa Indonesia yang sederhana.

Aturan:
- Fokuskan ringkasan pada pH dan kondisi kontrol kapur otomatis
- Jika pH < 6.5 → jelaskan kapur otomatis aktif
- Jika pH >= 6.5 → jelaskan pH aman
- Selalu berikan saran yang bisa langsung dilakukan
- Gunakan bahasa yang sederhana, bisa dipahami petani

Format respons:
- Maksimal 2-3 kalimat
- Bahasa Indonesia sederhana, tanpa istilah teknis
- Tanpa JSON, tanpa markdown
- Langsung ke inti masalah dan saran`;

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
Aturan sistem: pH < 6.5 => aktuator kapur otomatis ON

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
       WHERE pond_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [pondId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        summary:
          "Belum ada data sensor. Sistem menunggu telemetri dari perangkat kolam.",
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
         WHERE pond_id = $1
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
  if (rows.length === 0) return "Belum ada data sensor untuk kolam ini.";

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
      `Data pH Kolam ${pondId} belum tersedia. Pastikan sensor pH aktif agar kontrol kapur otomatis berjalan.`,
    );
  } else if (latest.ph_level < 6.5) {
    parts.push(
      `pH Kolam ${pondId} turun ke ${latest.ph_level.toFixed(1)}. Sistem mengaktifkan aktuator kapur otomatis untuk koreksi.`,
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
