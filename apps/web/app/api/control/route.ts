import pool from "@/lib/db";
import { getMqttClient } from "@/lib/mqtt";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pondId, aerator } = body;

    // Validate input
    if (!pondId || !aerator) {
      return NextResponse.json(
        { success: false, error: "Missing pondId or aerator" },
        { status: 400 },
      );
    }

    if (aerator !== "ON" && aerator !== "OFF") {
      return NextResponse.json(
        { success: false, error: "aerator must be 'ON' or 'OFF'" },
        { status: 400 },
      );
    }

    // Publish MQTT control command
    const client = getMqttClient();
    const topic = `pond/${pondId}/control`;
    const payload = JSON.stringify({ aerator });

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Log the control command
    await pool.query(
      `INSERT INTO control_log (pond_id, aerator, source, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [pondId, aerator, "manual"],
    );

    console.log(`[API /control] Sent ${aerator} to ${topic}`);

    return NextResponse.json({
      success: true,
      message: `Aerator ${aerator} command sent to pond ${pondId}`,
    });
  } catch (error) {
    console.error("[API /control] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send control command" },
      { status: 500 },
    );
  }
}
