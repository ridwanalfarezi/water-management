import pool from "@/lib/db";
import { NextResponse } from "next/server";

interface PondSummary {
  pond_id: number;
  temperature: number | null;
  do_level: number | null;
  ph_level: number | null;
  solenoid_state: "ON" | "OFF" | null;
  control_mode: "AUTO" | "MANUAL" | null;
  rssi: number | null;
  created_at: string;
  status: "normal" | "peringatan" | "kritis";
}

function computeStatus(phLevel: number | null): PondSummary["status"] {
  if (phLevel === null || phLevel < 6 || phLevel > 8.5) return "kritis";
  if (phLevel < 6.5 || phLevel > 7.5) return "peringatan";
  return "normal";
}

export async function GET() {
  try {
    // Get the latest reading for each pond using DISTINCT ON
    const result = await pool.query(
      `SELECT DISTINCT ON (pond_id)
         pond_id, temperature, do_level, ph_level,
         solenoid_state, control_mode, rssi, created_at
       FROM sensor_data
       ORDER BY pond_id, created_at DESC`,
    );

    const ponds: PondSummary[] = result.rows.map((row) => ({
      pond_id: row.pond_id,
      temperature: row.temperature,
      do_level: row.do_level,
      ph_level: row.ph_level,
      solenoid_state: row.solenoid_state,
      control_mode: row.control_mode,
      rssi: row.rssi,
      created_at: row.created_at,
      status: computeStatus(row.ph_level),
    }));

    return NextResponse.json({
      success: true,
      data: ponds,
    });
  } catch (error) {
    console.error("[API /ponds] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data kolam" },
      { status: 500 },
    );
  }
}
