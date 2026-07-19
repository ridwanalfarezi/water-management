import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pondId = searchParams.get("pondId");

    let result;
    if (pondId) {
      const pondIdNumber = Number(pondId);
      if (!Number.isInteger(pondIdNumber) || pondIdNumber <= 0) {
        return NextResponse.json(
          { success: false, error: "pondId harus berupa bilangan bulat positif" },
          { status: 400 },
        );
      }
      result = await pool.query(
        `SELECT id, pond_id, temperature, do_level, ph_level,
                solenoid_state, control_mode, rssi, created_at
         FROM sensor_data
         WHERE device_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [pondIdNumber],
      );
    } else {
      result = await pool.query(
        `SELECT id, pond_id, temperature, do_level, ph_level,
                solenoid_state, control_mode, rssi, created_at
         FROM sensor_data
         WHERE device_id IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 20`,
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("[API /data] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data sensor" },
      { status: 500 },
    );
  }
}
