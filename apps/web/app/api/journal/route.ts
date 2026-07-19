import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pondId = searchParams.get("pondId");

    if (!pondId) {
      return NextResponse.json(
        { success: false, error: "Parameter pondId diperlukan" },
        { status: 400 },
      );
    }

    const pondIdNum = Number(pondId);
    if (!Number.isInteger(pondIdNum) || pondIdNum <= 0) {
      return NextResponse.json(
        { success: false, error: "pondId harus berupa bilangan bulat positif" },
        { status: 400 },
      );
    }

    // Get today's journal entries for this pond
    const result = await pool.query(
      `SELECT id, pond_id, entry_type, content, created_at
       FROM pond_journal
       WHERE device_id = $1
         AND created_at::date = CURRENT_DATE
       ORDER BY created_at DESC`,
      [pondIdNum],
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("[API /journal GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data jurnal" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pondId, entryType, content } = body;

    // Validate
    if (!pondId || !entryType || !content) {
      return NextResponse.json(
        { success: false, error: "pondId, entryType, dan content diperlukan" },
        { status: 400 },
      );
    }

    const validTypes = ["pakan", "pengapuran", "sampling", "catatan"];
    if (!validTypes.includes(entryType)) {
      return NextResponse.json(
        { success: false, error: `entryType harus salah satu dari: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const pondIdNum = Number(pondId);
    if (!Number.isInteger(pondIdNum) || pondIdNum <= 0) {
      return NextResponse.json(
        { success: false, error: "pondId harus berupa bilangan bulat positif" },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `INSERT INTO pond_journal (pond_id, device_id, entry_type, content, created_at)
       SELECT id, id, $2, $3, NOW()
       FROM devices
       WHERE id = $1
       RETURNING id, pond_id, entry_type, content, created_at`,
      [pondIdNum, entryType, content.trim()],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("[API /journal POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan jurnal" },
      { status: 500 },
    );
  }
}
