import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface SensorRow {
  pond_id: number;
  temperature: number;
  do_level: number;
  created_at: Date;
}

const SYSTEM_INSTRUCTION = `You are an expert aquaculture assistant AI.

You are given recent water quality data from a fish pond system. Your task is to analyze the data and provide a short, practical recommendation for the farmer.

Rules:
- If DO < 3 → strongly recommend turning on aerator
- If DO is stable and safe → say conditions are safe
- If DO is decreasing → warn early before it gets critical
- Always include actionable advice

Response format:
- Maximum 3 sentences
- Use simple, clear language
- No technical jargon, no JSON, no markdown
- Be concise, practical, and helpful
- Avoid generic statements`;

function buildUserPrompt(rows: SensorRow[]): string {
  const sensorJson = rows.map((r) => ({
    temperature: r.temperature,
    do: r.do_level,
    created_at: new Date(r.created_at).toISOString(),
  }));

  // Pre-compute trend
  const doValues = rows.map((r) => r.do_level);
  const midpoint = Math.floor(rows.length / 2);
  const olderAvg =
    doValues.slice(midpoint).reduce((a, b) => a + b, 0) /
    (doValues.length - midpoint || 1);
  const newerAvg =
    doValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / (midpoint || 1);
  const trend =
    newerAvg < olderAvg - 0.5
      ? "decreasing"
      : newerAvg > olderAvg + 0.5
        ? "increasing"
        : "stable";

  return `Here are the latest ${rows.length} sensor readings from the pond (newest first):

${JSON.stringify(sensorJson, null, 2)}

DO trend over this period: ${trend}
Latest DO: ${rows[0].do_level} mg/L
Latest Temperature: ${rows[0].temperature}°C

Analyze and advise.`;
}

export async function GET() {
  try {
    const result = await pool.query<SensorRow>(
      `SELECT pond_id, temperature, do_level, created_at
       FROM sensor_data
       ORDER BY created_at DESC
       LIMIT 20`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        insight:
          "No sensor data available yet. The system is waiting for telemetry from pond devices.",
        source: "fallback",
      });
    }

    // If no API key configured, return rule-based fallback
    if (!process.env.GEMINI_API_KEY) {
      const insight = generateFallbackInsight(result.rows);
      return NextResponse.json({
        success: true,
        insight,
        source: "rule-based",
      });
    }

    // Call Gemini
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
      response.text?.trim() || "Unable to generate insight at this time.";

    return NextResponse.json({
      success: true,
      insight,
      source: "ai",
    });
  } catch (error) {
    console.error("[API /ai-insight] Error:", error);

    // Graceful degradation: return rule-based insight on LLM failure
    try {
      const result = await pool.query<SensorRow>(
        `SELECT pond_id, temperature, do_level, created_at
         FROM sensor_data
         ORDER BY created_at DESC
         LIMIT 20`
      );
      const insight = generateFallbackInsight(result.rows);
      return NextResponse.json({
        success: true,
        insight,
        source: "rule-based",
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to generate insight" },
        { status: 500 }
      );
    }
  }
}

/**
 * Rule-based fallback when Gemini is unavailable.
 */
function generateFallbackInsight(rows: SensorRow[]): string {
  if (rows.length === 0) return "No sensor data available yet.";

  const latest = rows[0];
  const doValues = rows.map((r) => r.do_level);

  const midpoint = Math.floor(rows.length / 2);
  const olderAvg =
    doValues.slice(midpoint).reduce((a, b) => a + b, 0) /
    (doValues.length - midpoint || 1);
  const newerAvg =
    doValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / (midpoint || 1);

  const parts: string[] = [];

  if (latest.do_level < 3) {
    parts.push(
      `Oxygen is critically low at ${latest.do_level.toFixed(2)} mg/L. Turn on the aerator immediately to protect the fish.`
    );
  } else if (latest.do_level < 4) {
    parts.push(
      `Oxygen is at ${latest.do_level.toFixed(2)} mg/L, getting close to unsafe levels. Keep a close watch.`
    );
  } else {
    parts.push(
      `Water conditions are stable with oxygen at ${latest.do_level.toFixed(2)} mg/L and temperature at ${latest.temperature.toFixed(1)}°C.`
    );
  }

  if (newerAvg < olderAvg - 0.5) {
    parts.push(
      `Oxygen levels are dropping. Consider turning on the aerator before it gets critical.`
    );
  } else if (newerAvg > olderAvg + 0.5) {
    parts.push(`Oxygen levels are improving. Conditions are getting better.`);
  } else {
    parts.push(`Oxygen has been steady over recent readings. No action needed.`);
  }

  return parts.join(" ");
}
