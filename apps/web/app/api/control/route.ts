import pool from "@/lib/db";
import { getMqttClient } from "@/lib/mqtt";
import { parseDemoCommand } from "@/lib/demo";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type ControlPayload = { commandId: string } & NonNullable<ReturnType<typeof parseDemoCommand>>;

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return String((error as { code?: unknown }).code);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 100) : "MQTT publish failed";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pondId = Number(body.pondId);
    const demoCommand = parseDemoCommand(body);
    if (!demoCommand) {
      return NextResponse.json({ success: false, error: "Perintah demo tidak valid. Muat ulang status perangkat." }, { status: 400 });
    }

    if (!Number.isInteger(pondId) || pondId <= 0) {
      return NextResponse.json(
        { success: false, error: "pondId must be a positive integer" },
        { status: 400 },
      );
    }

    const deviceResult = await pool.query<{
      device_uid: string;
      is_online: boolean;
    }>(
      `SELECT device_uid,
              connection_state = 'online'
              AND last_seen_at >= NOW() - INTERVAL '15 seconds' AS is_online
       FROM devices
       WHERE id = $1`,
      [pondId],
    );

    if (deviceResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device tidak ditemukan" },
        { status: 404 },
      );
    }
    if (!deviceResult.rows[0].is_online) {
      return NextResponse.json(
        { success: false, error: "Device offline" },
        { status: 409 },
      );
    }

    const commandId = randomUUID();
    let payload: ControlPayload;
    let action: string;
    let requestedMode: "AUTO" | "MANUAL";
    let requestedSolenoid: "ON" | "OFF" | null;

    payload = { commandId, ...demoCommand };
    action = `DEMO_${demoCommand.demoAction}`;
    requestedMode = "MANUAL";
    requestedSolenoid = demoCommand.demoAction === "STOP" || demoCommand.demoAction === "RESET" || demoCommand.demoAction === "PAUSE" ? "OFF" : null;

    // Closing commands must not wait behind an unacknowledged story command.
    if (demoCommand.demoAction === "STOP" || demoCommand.demoAction === "RESET") {
      await pool.query(`UPDATE control_log SET status = 'TIMED_OUT', timed_out_at = NOW()
        WHERE device_id = $1 AND status IN ('PENDING', 'SENT')`, [pondId]);
    }

    try {
      await pool.query(
        `INSERT INTO control_log
           (pond_id, device_id, command_id, action, source, status,
            requested_mode, requested_solenoid, created_at)
         VALUES ($1, $1, $2, $3, 'manual', 'PENDING', $4, $5, NOW())`,
        [pondId, commandId, action, requestedMode, requestedSolenoid],
      );
    } catch (error) {
      if (databaseErrorCode(error) === "23505") {
        const active = await pool.query<{ command_id: string }>(
          `SELECT command_id
           FROM control_log
           WHERE device_id = $1 AND status IN ('PENDING', 'SENT')
           ORDER BY created_at DESC
           LIMIT 1`,
          [pondId],
        );
        return NextResponse.json(
          {
            success: false,
            error: "Command masih diproses",
            commandId: active.rows[0]?.command_id,
          },
          { status: 409 },
        );
      }
      throw error;
    }

    const client = getMqttClient();
    const deviceUid = deviceResult.rows[0].device_uid;
    const topic = `device/${deviceUid}/control`;
    const message = JSON.stringify(payload);

    try {
      await new Promise<void>((resolve, reject) => {
        client.publish(
          topic,
          message,
          { qos: 1, retain: false },
          (error) => (error ? reject(error) : resolve()),
        );
      });
    } catch (error) {
      const reason = errorMessage(error);
      await pool.query(
        `UPDATE control_log
         SET status = 'PUBLISH_FAILED', failure_reason = $2
         WHERE command_id = $1 AND status IN ('PENDING', 'SENT')`,
        [commandId, reason],
      );
      console.error(`[API /control] Publish failed for ${commandId}:`, error);
      return NextResponse.json(
        {
          success: false,
          commandId,
          status: "PUBLISH_FAILED",
          error: "Gagal mengirim command ke broker MQTT",
          reason,
        },
        { status: 502 },
      );
    }

    // A very fast ACK may already have moved PENDING to a final state. Never
    // overwrite that acknowledgement with SENT.
    await pool.query(
      `UPDATE control_log
       SET status = 'SENT', sent_at = NOW()
       WHERE command_id = $1 AND status = 'PENDING'`,
      [commandId],
    );

    console.log(`[API /control] Sent ${commandId} to ${topic}`);
    return NextResponse.json(
      { success: true, commandId, status: "SENT" },
      { status: 202 },
    );
  } catch (error) {
    console.error("[API /control] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send control command" },
      { status: 500 },
    );
  }
}
