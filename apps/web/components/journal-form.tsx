"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Catatan Kegiatan</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Simpan kegiatan penting agar kondisi kolam mudah ditelusuri.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor={`journal-type-${pondId}`} className="sr-only">
              Jenis kegiatan
            </label>
            <select
              id={`journal-type-${pondId}`}
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
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
      </CardContent>
    </Card>
  );
}
