import pool from "@/lib/db";
import { getMqttClient } from "@/lib/mqtt";
import { NextRequest, NextResponse } from "next/server";

type ControlPayload =
  | { mode: "AUTO" }
  | { mode: "MANUAL"; solenoid: "ON" | "OFF" };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pondId = Number(body.pondId);

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

    let payload: ControlPayload;
    let action: string;

    if (body.mode === "AUTO") {
      payload = { mode: "AUTO" };
      action = "SOLENOID_AUTO";
    } else if (body.solenoid === "ON" || body.solenoid === "OFF") {
      payload = { mode: "MANUAL", solenoid: body.solenoid };
      action = `SOLENOID_${body.solenoid}`;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Send mode 'AUTO' or solenoid 'ON'/'OFF'",
        },
        { status: 400 },
      );
    }

    const client = getMqttClient();
    const deviceUid = deviceResult.rows[0].device_uid;
    const topic = `device/${deviceUid}/control`;
    const message = JSON.stringify(payload);

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await pool.query(
      `INSERT INTO control_log (pond_id, device_id, action, source, created_at)
       VALUES ($1, $1, $2, 'manual', NOW())`,
      [pondId, action],
    );

    console.log(`[API /control] Sent ${message} to ${topic}`);
    return NextResponse.json({
      success: true,
      message: `Command sent to pond ${pondId}`,
    });
  } catch (error) {
    console.error("[API /control] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send control command" },
      { status: 500 },
    );
  }
}
