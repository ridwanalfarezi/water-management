export const DEMO_ACTIONS = ["START", "NEXT", "PAUSE", "RESUME", "RESET", "STOP"] as const;
export type DemoAction = (typeof DEMO_ACTIONS)[number];
export const DEMO_STAGES = {
  NORMAL: { title: "Air dalam kondisi normal", description: "Awalnya, kondisi air stabil. Mari lihat bagaimana Kolam Pintar merespons perubahan.", tone: "normal" },
  FOOD: { title: "Saat ikan diberi makan", description: "Sisa pakan dan kotoran dapat memengaruhi kualitas air seiring waktu.", tone: "normal" },
  DANGER: { title: "pH menuju kondisi rendah", description: "pH simulasi turun menuju 6,0. Saat melewati 6,5, popup dan sirene memberi peringatan.", tone: "danger" },
  ACTIVE: { title: "Kolam Pintar bekerja", description: "ESP32 mengaktifkan relay. Valve demo terbuka selama maksimal 3 detik.", tone: "active" },
  RECOVERY: { title: "Kondisi air mulai pulih", description: "Valve sudah ditutup. Layar memperagakan proses koreksi dengan waktu yang dipercepat.", tone: "active" },
  RESTORED: { title: "Kembali normal", description: "Deteksi, proses, lalu tindakan. Itulah alur kerja Kolam Pintar.", tone: "normal" },
  READY: { title: "Sekarang, coba game-nya!", description: "Demo selesai. Giliran kamu mencoba fishing game bersama crew.", tone: "normal" },
  STOPPED: { title: "Demo dihentikan", description: "Perangkat telah menerima perintah hentikan. Valve dalam keadaan tertutup.", tone: "neutral" },
} as const;
export type DemoStep = keyof typeof DEMO_STAGES;

export const DEMO_ADVANCE = {
  NORMAL: { action: "START", label: "Mulai: pemberian pakan", next: "Peragakan pemberian pakan", description: "Tekan sambil memperagakan pakan. pH simulasi turun perlahan dari sekitar 7,5 menuju 7,0 selama 6 detik." },
  FOOD: { action: "NEXT", label: "Simulasikan pH rendah", next: "Peragakan perubahan kualitas air", description: "pH turun menuju 6,0 selama 4 detik. Saat melewati 6,5, popup dan sirene muncul; valve masih tertutup." },
  DANGER: { action: "NEXT", label: "Buka valve demo · 3 detik", next: "Peragakan respons valve", description: "Gunakan tombol ini atau tombol di popup. Valve membuka selama 3 detik, menutup otomatis, lalu pH simulasi pulih sekitar 7,5." },
  ACTIVE: { action: null, label: "Valve sedang terbuka…", next: "Valve menutup otomatis", description: "Tidak perlu menekan tombol berikutnya. Setelah maksimal 3 detik, valve menutup dan tahap pemulihan dimulai." },
  RECOVERY: { action: null, label: "Menunggu pH pulih…", next: "Kembali ke kondisi normal", description: "Tunggu 4 detik. pH simulasi naik ke sekitar 7,5; popup dan sirene berhenti saat pH melewati 6,6." },
  RESTORED: { action: "NEXT", label: "Selesai demo · lanjut ke game", next: "Ajak pengunjung bermain", description: "Tampilkan ajakan fishing game dan arahkan pengunjung ke permainan fisik bersama crew." },
  READY: { action: "START", label: "Ulangi: pemberian pakan", next: "Mulai putaran untuk pengunjung berikutnya", description: "Kembali ke tahap pakan. Gunakan Reset jika ingin memperkenalkan kondisi normal terlebih dahulu." },
  STOPPED: { action: "START", label: "Mulai ulang: pemberian pakan", next: "Mulai kembali cerita demo", description: "Valve sudah tertutup. Mulai lagi dari pemberian pakan, atau Reset untuk kembali ke tahap awal." },
} as const;

export function parseDemoCommand(body: Record<string, unknown>) {
  if (!DEMO_ACTIONS.includes(body.demoAction as DemoAction)) return null;
  const demoAction = body.demoAction as DemoAction;
  if (demoAction === "RESET" || demoAction === "STOP") return { demoAction };
  if (typeof body.demoSession !== "string" || !/^[0-9A-F]{16}$/.test(body.demoSession) ||
      !Number.isInteger(body.demoRevision) || Number(body.demoRevision) < 0 || Number(body.demoRevision) > 0xffffffff) return null;
  return { demoAction, demoSession: body.demoSession, demoRevision: Number(body.demoRevision) };
}
