import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pondId = searchParams.get("pondId");

    let result;
    if (pondId) {
      result = await pool.query(
        `SELECT id, pond_id, temperature, do_level, ph_level, created_at
         FROM sensor_data
         WHERE pond_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [parseInt(pondId, 10)],
      );
    } else {
      result = await pool.query(
        `SELECT id, pond_id, temperature, do_level, ph_level, created_at
         FROM sensor_data
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
