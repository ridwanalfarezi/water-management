import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CommandRow {
  command_id: string;
  status: string;
  requested_mode: "AUTO" | "MANUAL" | null;
  requested_solenoid: "ON" | "OFF" | null;
  applied_mode: "AUTO" | "MANUAL" | null;
  applied_solenoid: "ON" | "OFF" | null;
  relay_pin_level: number | null;
  failure_reason: string | null;
  created_at: string;
  sent_at: string | null;
  acknowledged_at: string | null;
  timed_out_at: string | null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ commandId: string }> },
) {
  try {
    const { commandId } = await context.params;
    if (!UUID_PATTERN.test(commandId)) {
      return NextResponse.json(
        { success: false, error: "commandId tidak valid" },
        { status: 400 },
      );
    }

    const result = await pool.query<CommandRow>(
      `SELECT command_id, status, requested_mode, requested_solenoid,
              applied_mode, applied_solenoid, relay_pin_level,
              failure_reason, created_at, sent_at, acknowledged_at,
              timed_out_at
       FROM control_log
       WHERE command_id = $1`,
      [commandId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Command tidak ditemukan" },
        { status: 404 },
      );
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        commandId: row.command_id,
        status: row.status,
        requested: {
          mode: row.requested_mode,
          solenoid: row.requested_solenoid,
        },
        applied:
          row.applied_mode && row.applied_solenoid && row.relay_pin_level !== null
            ? {
                mode: row.applied_mode,
                solenoid: row.applied_solenoid,
                relayPinLevel: row.relay_pin_level,
              }
            : null,
        reason: row.failure_reason,
        createdAt: row.created_at,
        sentAt: row.sent_at,
        acknowledgedAt: row.acknowledged_at,
        timedOutAt: row.timed_out_at,
      },
    });
  } catch (error) {
    console.error("[API /control/:commandId] Error:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil status command" },
      { status: 500 },
    );
  }
}
