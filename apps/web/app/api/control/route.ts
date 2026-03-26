import pool from "@/lib/db";
import { getMqttClient } from "@/lib/mqtt";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pondId, lime } = body;
    const hasLimeCommand = lime !== undefined;

    // Validate input
    if (!pondId || !hasLimeCommand) {
      return NextResponse.json(
        { success: false, error: "Missing pondId or lime command" },
        { status: 400 },
      );
    }

    if (hasLimeCommand && lime !== "ON" && lime !== "OFF") {
      return NextResponse.json(
        { success: false, error: "lime must be 'ON' or 'OFF'" },
        { status: 400 },
      );
    }

    // Publish MQTT control command
    const client = getMqttClient();
    const topic = `pond/${pondId}/control`;
    const payload = JSON.stringify({ lime });

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    try {
      await pool.query(
        `INSERT INTO control_log (pond_id, action, source, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [pondId, `LIME_${lime}`, "manual"],
      );
    } catch (err: unknown) {
      // Backward compatibility for DBs that still have legacy `aerator` column.
      const pgErr = err as { code?: string };
      if (pgErr?.code === "42703") {
        await pool.query(
          `INSERT INTO control_log (pond_id, aerator, source, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [pondId, `LIME_${lime}`, "manual"],
        );
      } else {
        throw err;
      }
    }

    console.log(`[API /control] Sent ${payload} to ${topic}`);

    return NextResponse.json({
      success: true,
      message: `Lime ${lime} command sent to pond ${pondId}`,
    });
  } catch (error) {
    console.error("[API /control] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send control command" },
      { status: 500 },
    );
  }
}
