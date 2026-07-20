"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface JournalFormProps {
  pondId: number;
  onSaved?: () => void;
}

const ENTRY_TYPES = [
  { value: "pakan", label: "Pemberian pakan" },
  { value: "pengapuran", label: "Pengapuran" },
  { value: "sampling", label: "Pengecekan air" },
  { value: "catatan", label: "Catatan lainnya" },
];

export function JournalForm({ pondId, onSaved }: JournalFormProps) {
  const [entryType, setEntryType] = useState("catatan");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pondId, entryType, content: content.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        setContent("");
        setFeedback("Catatan berhasil disimpan.");
        onSaved?.();
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback("Catatan belum tersimpan. Coba lagi.");
      }
    } catch {
      setFeedback("Catatan belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="h-full p-5 sm:p-6" aria-labelledby={`journal-form-title-${pondId}`}>
      <div>
        <h3 id={`journal-form-title-${pondId}`} className="text-sm font-semibold">Catatan kegiatan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Simpan kegiatan penting agar kondisi kolam mudah ditelusuri.
        </p>
      </div>
      <div className="mt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor={`journal-type-${pondId}`} className="sr-only">
              Jenis kegiatan
            </label>
            <select
              id={`journal-type-${pondId}`}
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`journal-content-${pondId}`} className="sr-only">
              Isi catatan
            </label>
            <textarea
              id={`journal-content-${pondId}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Contoh: memberi pakan 2 kg pukul 07.00"
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-zinc-300 disabled:text-zinc-600"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {saving ? "Menyimpan..." : "Simpan catatan"}
            </button>
            {feedback && (
              <span
                role="status"
                aria-live="polite"
                className={`text-xs font-medium ${feedback.startsWith("Catatan berhasil") ? "text-emerald-700" : "text-red-700"}`}
              >
                {feedback}
              </span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}
