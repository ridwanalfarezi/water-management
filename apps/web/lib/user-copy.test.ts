import { describe, expect, test } from "bun:test";
import {
  getCommandFeedbackCopy,
  getConnectionLabel,
  getControlRequestError,
  getFlowLabel,
  getModeLabel,
  getPondStatusLabel,
  getSignalLabel,
} from "./user-copy";

describe("copy untuk pengguna kolam", () => {
  test("memetakan kondisi air dan koneksi", () => {
    expect(getPondStatusLabel("online", "normal")).toBe("Aman");
    expect(getPondStatusLabel("online", "peringatan")).toBe("Perlu diperiksa");
    expect(getPondStatusLabel("online", "kritis")).toBe("Butuh tindakan");
    expect(getPondStatusLabel("online", "belum_ada_data")).toBe(
      "Menunggu bacaan",
    );
    expect(getPondStatusLabel("offline", "normal")).toBe("Alat tidak terhubung");
    expect(getConnectionLabel("online")).toBe("Alat terhubung");
    expect(getConnectionLabel("offline")).toBe("Alat tidak terhubung");
  });

  test("mengelompokkan kekuatan sinyal", () => {
    expect(getSignalLabel(-60)).toBe("Kuat");
    expect(getSignalLabel(-61)).toBe("Cukup");
    expect(getSignalLabel(-75)).toBe("Cukup");
    expect(getSignalLabel(-76)).toBe("Lemah");
    expect(getSignalLabel(null)).toBe("Belum ada bacaan");
  });

  test("mengubah mode dan aliran menjadi bahasa pengguna", () => {
    expect(getModeLabel("AUTO")).toBe("Otomatis");
    expect(getModeLabel("MANUAL")).toBe("Manual");
    expect(getModeLabel(null)).toBe("Belum diketahui");
    expect(getFlowLabel("ON")).toBe("Mengalir");
    expect(getFlowLabel("OFF")).toBe("Berhenti");
    expect(getFlowLabel(null)).toBe("Belum diketahui");
  });

  test("memetakan hasil pengaturan tanpa istilah teknis", () => {
    expect(getCommandFeedbackCopy("PENDING", null)).toBeNull();
    expect(getCommandFeedbackCopy("SENT", null)).toBeNull();
    expect(getCommandFeedbackCopy("APPLIED", "ON")?.message).toBe(
      "Pengaturan berhasil diterapkan. Aliran sekarang mengalir.",
    );
    expect(getCommandFeedbackCopy("APPLIED_LATE", "OFF")?.message).toContain(
      "baru mengonfirmasi",
    );
    expect(getCommandFeedbackCopy("REJECTED", null)?.tone).toBe("error");
    expect(getCommandFeedbackCopy("REJECTED_LATE", null)?.message).toBe(
      "Pengaturan tidak dapat diterapkan. Coba lagi atau periksa alat.",
    );
    expect(getCommandFeedbackCopy("TIMED_OUT", null)?.tone).toBe("warning");
    expect(getCommandFeedbackCopy("PUBLISH_FAILED", null)?.message).toBe(
      "Pengaturan belum terkirim. Periksa koneksi lalu coba lagi.",
    );
  });

  test("menyederhanakan error permintaan", () => {
    expect(getControlRequestError(409, "Device offline")).toContain(
      "Alat sedang tidak terhubung",
    );
    expect(getControlRequestError(409, "Command masih diproses")).toContain(
      "masih diproses",
    );
    expect(getControlRequestError(500)).toBe(
      "Pengaturan belum dapat dikirim. Coba lagi.",
    );
  });
});
