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

const SYSTEM_INSTRUCTION = `Kamu adalah asisten AI ahli akuakultur.

Kamu diberikan data kualitas air terbaru dari kolam ikan. Tugasmu adalah menganalisis data dan memberikan rekomendasi singkat dan praktis untuk petani.

Aturan:
- Fokus utama analisis adalah pH untuk kontrol solenoid asam otomatis
- Jika pH > 7.5 → jelaskan bahwa solenoid otomatis sedang/akan terbuka untuk menurunkan pH
- Jika pH < 6.5 → jelaskan bahwa solenoid asam harus tetap tertutup dan perlu pemeriksaan manual
- Jika pH 6.5–7.5 → sampaikan kondisi pH aman
- Selalu berikan saran yang bisa langsung dilakukan

Format respons:
- Maksimal 3 kalimat
- Bahasa Indonesia sederhana
- Tanpa istilah teknis, tanpa JSON, tanpa markdown
- Ringkas, praktis, dan membantu
- Hindari pernyataan umum`;

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
Aturan sistem: jika pH > 7.5 maka solenoid asam otomatis ON dan OFF setelah pH < 7.3

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
         WHERE pond_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [parseInt(pondId, 10)],
      );
    } else {
      result = await pool.query<SensorRow>(
        `SELECT pond_id, temperature, do_level, ph_level, created_at
         FROM sensor_data
         ORDER BY created_at DESC
         LIMIT 20`,
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        insight:
          "Belum ada data sensor. Sistem menunggu telemetri dari perangkat kolam.",
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
           WHERE pond_id = $1
           ORDER BY created_at DESC
           LIMIT 20`,
          [parseInt(pondId, 10)],
        );
      } else {
        result = await pool.query<SensorRow>(
          `SELECT pond_id, temperature, do_level, ph_level, created_at
           FROM sensor_data
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
  if (rows.length === 0) return "Belum ada data sensor.";

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
      "Data pH belum tersedia. Pastikan sensor pH aktif agar kontrol solenoid otomatis berjalan.",
    );
  } else if (latest.ph_level > 7.5) {
    parts.push(
      `pH saat ini ${latest.ph_level.toFixed(1)}. Solenoid otomatis dibuka untuk menurunkan pH.`,
    );
  } else if (latest.ph_level < 6.5) {
    parts.push(
      `pH saat ini ${latest.ph_level.toFixed(1)} dan terlalu rendah. Solenoid asam tetap tertutup; periksa air secara manual.`,
    );
  } else {
    parts.push(
      `pH saat ini ${latest.ph_level.toFixed(1)} dan berada dalam rentang aman. Solenoid tetap siaga.`,
    );
  }

  if (newerAvg < olderAvg - 0.1) {
    parts.push(
      `Tren pH cenderung menurun. Pastikan solenoid tertutup jika pH mendekati batas bawah.`,
    );
  } else if (newerAvg > olderAvg + 0.1) {
    parts.push(`Tren pH membaik. Pertahankan pemantauan rutin.`);
  } else {
    parts.push(`Tren pH stabil. Tidak perlu tindakan tambahan saat ini.`);
  }

  return parts.join(" ");
}
