export type ConnectionStatus = "online" | "offline";
export type WaterStatus =
  | "normal"
  | "peringatan"
  | "kritis"
  | "belum_ada_data";
export type CommandStatus =
  | "PENDING"
  | "SENT"
  | "APPLIED"
  | "REJECTED"
  | "TIMED_OUT"
  | "APPLIED_LATE"
  | "REJECTED_LATE"
  | "PUBLISH_FAILED";

export const WATER_STATUS_LABEL: Record<WaterStatus, string> = {
  normal: "Aman",
  peringatan: "Perlu diperiksa",
  kritis: "Butuh tindakan",
  belum_ada_data: "Menunggu bacaan",
};

export function getPondStatusLabel(
  connectionStatus: ConnectionStatus,
  waterStatus: WaterStatus,
): string {
  return connectionStatus === "offline"
    ? "Alat tidak terhubung"
    : WATER_STATUS_LABEL[waterStatus];
}

export function getConnectionLabel(status: ConnectionStatus): string {
  return status === "online" ? "Alat terhubung" : "Alat tidak terhubung";
}

export function getSignalLabel(rssi: number | null): string {
  if (rssi === null) return "Belum ada bacaan";
  if (rssi >= -60) return "Kuat";
  if (rssi >= -75) return "Cukup";
  return "Lemah";
}

export function getModeLabel(mode: "AUTO" | "MANUAL" | null): string {
  if (mode === "AUTO") return "Otomatis";
  if (mode === "MANUAL") return "Manual";
  return "Belum diketahui";
}

export function getFlowLabel(state: "ON" | "OFF" | null): string {
  if (state === "ON") return "Mengalir";
  if (state === "OFF") return "Berhenti";
  return "Belum diketahui";
}

export type FeedbackTone = "success" | "warning" | "error";

export function getCommandFeedbackCopy(
  status: CommandStatus,
  appliedSolenoid: "ON" | "OFF" | null,
): { tone: FeedbackTone; message: string } | null {
  if (status === "PENDING" || status === "SENT") return null;

  if (status === "APPLIED") {
    return {
      tone: "success",
      message: `Pengaturan berhasil diterapkan. Aliran sekarang ${getFlowLabel(appliedSolenoid).toLowerCase()}.`,
    };
  }
  if (status === "APPLIED_LATE") {
    return {
      tone: "success",
      message: `Alat baru mengonfirmasi perubahan. Pengaturan sudah diterapkan dan aliran sekarang ${getFlowLabel(appliedSolenoid).toLowerCase()}.`,
    };
  }
  if (status === "TIMED_OUT") {
    return {
      tone: "warning",
      message:
        "Belum ada jawaban dari alat. Kondisi aliran belum dapat dipastikan. Periksa kolam sebelum mencoba lagi.",
    };
  }
  if (status === "PUBLISH_FAILED") {
    return {
      tone: "error",
      message:
        "Pengaturan belum terkirim. Periksa koneksi lalu coba lagi.",
    };
  }
  return {
    tone: "error",
    message:
      "Pengaturan tidak dapat diterapkan. Coba lagi atau periksa alat.",
  };
}

export function getControlRequestError(
  httpStatus: number,
  apiError?: string,
): string {
  if (httpStatus === 409 && apiError?.toLowerCase().includes("offline")) {
    return "Alat sedang tidak terhubung. Tunggu sampai tersambung lalu coba lagi.";
  }
  if (httpStatus === 409) {
    return "Pengaturan sebelumnya masih diproses. Tunggu sebentar.";
  }
  return "Pengaturan belum dapat dikirim. Coba lagi.";
}
