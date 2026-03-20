import pool from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT id, pond_id, temperature, do_level, created_at
       FROM sensor_data
       ORDER BY created_at DESC
       LIMIT 20`,
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("[API /data] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch sensor data" },
      { status: 500 },
    );
  }
}
