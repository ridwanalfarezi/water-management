import pool from "@/lib/db";
import { NextResponse } from "next/server";

interface PondSummary {
  pond_id: number;
  device_uid: string;
  temperature: number | null;
  do_level: number | null;
  ph_level: number | null;
  solenoid_state: "ON" | "OFF" | null;
  control_mode: "AUTO" | "MANUAL" | null;
  rssi: number | null;
  created_at: string;
  last_seen_at: string;
  connection_status: "online" | "offline";
  water_status: "normal" | "peringatan" | "kritis" | "belum_ada_data";
}

function computeWaterStatus(phLevel: number | null): PondSummary["water_status"] {
  if (phLevel === null) return "belum_ada_data";
  if (phLevel < 6 || phLevel > 8.5) return "kritis";
  if (phLevel < 6.5 || phLevel > 7.5) return "peringatan";
  return "normal";
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT d.id AS pond_id,
              d.device_uid,
              d.last_seen_at,
              CASE
                WHEN d.connection_state = 'online'
                 AND d.last_seen_at >= NOW() - INTERVAL '15 seconds'
                THEN 'online'
                ELSE 'offline'
              END AS connection_status,
              latest.temperature,
              latest.do_level,
              latest.ph_level,
              latest.solenoid_state,
              latest.control_mode,
              latest.rssi,
              latest.created_at
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT temperature, do_level, ph_level, solenoid_state,
                control_mode, rssi, created_at
         FROM sensor_data
         WHERE device_id = d.id
         ORDER BY created_at DESC
         LIMIT 1
       ) latest ON TRUE
       ORDER BY d.id`,
    );

    const ponds: PondSummary[] = result.rows.map((row) => ({
      pond_id: row.pond_id,
      device_uid: row.device_uid,
      temperature: row.temperature,
      do_level: row.do_level,
      ph_level: row.ph_level,
      solenoid_state: row.solenoid_state,
      control_mode: row.control_mode,
      rssi: row.rssi,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
      connection_status: row.connection_status,
      water_status: computeWaterStatus(row.ph_level),
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
