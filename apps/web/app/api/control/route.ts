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
    const topic = `pond/${pondId}/control`;
    const message = JSON.stringify(payload);

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await pool.query(
      `INSERT INTO control_log (pond_id, action, source, created_at)
       VALUES ($1, $2, 'manual', NOW())`,
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
