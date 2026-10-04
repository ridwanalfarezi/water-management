export const DEMO_STEPS = ["NORMAL", "FOOD", "DANGER", "ACTIVE", "RECOVERY", "RESTORED", "READY", "STOPPED"] as const;
export interface DemoTelemetry {
  dataSource: "SIMULATION";
  demoStep: (typeof DEMO_STEPS)[number];
  demoPaused: boolean;
  demoRevision: number;
  demoSession: string;
}

export function parseDemoTelemetry(payload: Record<string, unknown>): DemoTelemetry | null {
  if (payload.dataSource !== "SIMULATION" ||
      !DEMO_STEPS.includes(payload.demoStep as DemoTelemetry["demoStep"]) ||
      typeof payload.demoPaused !== "boolean" ||
      !Number.isInteger(payload.demoRevision) || Number(payload.demoRevision) < 0 || Number(payload.demoRevision) > 0xffffffff ||
      typeof payload.demoSession !== "string" || !/^[0-9A-F]{16}$/.test(payload.demoSession)) return null;
  return payload as unknown as DemoTelemetry;
}
