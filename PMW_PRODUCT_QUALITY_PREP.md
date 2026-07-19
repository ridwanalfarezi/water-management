# PMW UNJ — Product & Quality Test Prep: Kolam Pintar

Tanggal persiapan: 20 Juli 2026  
Acara: Product & Quality Test PMW UNJ  
Dokumen utama: tab **Proposal Fix - PMW** (`t.a5azuj9ejy2m`), bukan tab P2MW yang dibuka oleh link awal.

## Baca ini dulu: lima hal yang harus dibereskan malam ini

1. **Putuskan satu arah koreksi pH.** Proposal PMW mengatakan pH rendah dikoreksi memakai pH UP dengan dosing bertingkat. Firmware dan dashboard saat ini mengatakan pH tinggi dikoreksi memakai larutan asam. Jangan masuk ruang juri dengan dua versi kebenaran.
2. **Demo dosing hanya dengan cairan aman atau selang terlepas.** Firmware belum memiliki batas volume kumulatif, sensor aliran, deteksi probe rusak, atau cooldown pencampuran. Jangan demonstrasikan cairan kimia pada kolam berisi ikan.
3. **Bedakan bukti dan proyeksi.** Survei/wawancara adalah validasi masalah; target 200 pelanggan dan CRP 65% adalah proyeksi, bukan traction aktual.
4. **Siapkan perhitungan BEP yang dapat ditelusuri.** Klaim 8–10 bulan belum cukup hanya dengan membandingkan omzet langganan Rp15.036.000 dengan dana Rp14.948.600. Juri bisa meminta COGS, maintenance, CAC, churn, pajak, dan arus kas bulanan.
5. **Gunakan istilah yang jujur:** prototype/MVP, near-real-time, visual alert, dan rule-based recommendation. Jangan menyebut production-ready, teruji 24/7, notifikasi otomatis ke WhatsApp, atau auto-dosing aman sebelum ada bukti uji.

## Temuan utama audit

### Yang sudah nyata di codebase

- ESP32 membaca pH, melakukan averaging 10 sampel, dan menjalankan kontrol lokal dengan hysteresis.
- Relay dimulai dalam keadaan OFF saat boot.
- Mode manual ON kembali ke AUTO setelah 60 detik.
- Kontrol otomatis tetap berjalan ketika Wi-Fi, MQTT, atau server mati.
- Telemetri pH, status solenoid, mode kontrol, dan RSSI dikirim via MQTT setiap 5 detik.
- Worker memvalidasi payload lalu menyimpan data ke PostgreSQL.
- Dashboard menampilkan daftar kolam, pH terbaru, grafik 20 titik, status perangkat, kontrol manual/AUTO, jurnal harian, dan rekomendasi.
- Gemini bersifat opsional; tanpa API key aplikasi memakai fallback berbasis aturan.
- Build produksi dan TypeScript untuk web serta worker berhasil pada 20 Juli 2026.

### Yang belum terbukti atau belum ada

- Notifikasi eksternal melalui WhatsApp, SMS, push notification, atau email.
- Dosing bertingkat 2/5/7–8 detik dan fase cooldown seperti di proposal.
- Batas dosis maksimum per siklus/hari, sensor aliran, sensor level tangki, atau deteksi kebocoran.
- Deteksi probe pH terlepas, nilai tersangkut, drift, atau pembacaan tidak masuk akal.
- Autentikasi pengguna, otorisasi per kolam, TLS MQTT, dan identitas perangkat.
- Acknowledgement bahwa perintah dashboard benar-benar sudah diterapkan perangkat. API baru membuktikan pesan diterima broker; state aktual baru tampak pada telemetri berikutnya.
- Uji akurasi terhadap alat referensi, repeatability, durabilitas, ingress protection, dan uji lapangan jangka panjang.
- Pengujian end-to-end empat service pada audit ini karena Docker engine tidak sedang aktif.
- Kompilasi firmware karena Arduino CLI tidak tersedia.
- Unit test atau integration test otomatis; repository belum memiliki test suite.

## Kontradiksi proposal vs implementasi

| Topik | Proposal PMW | Codebase saat ini | Risiko jawaban |
|---|---|---|---|
| Arah koreksi | pH rendah → pH UP | pH tinggi → larutan asam | P0: keselamatan dan kredibilitas |
| Logika dosing | Pulsa 2/5/7–8 detik + cooldown | Valve terbuka terus sampai pH < 7,3 | P0: overdosing dan tidak sesuai demo |
| Volume | 40/100/150 ml | Tidak mengukur volume | P0: klaim tidak terbukti |
| Wadah | Botol 100 ml/unit | Manual ON maksimum 60 detik | P0: pada asumsi 20 ml/detik, botol habis sekitar 5 detik |
| Peringatan dini | Notifikasi otomatis | Alert visual di dashboard | P1: jangan mengklaim WhatsApp/push |
| Real-time | “real-time” | Telemetri 5 detik + polling 5 detik | Sebut near-real-time, latensi tipikal 5–10 detik |
| AI | Analisis kesehatan kolam | Ringkasan 20 pembacaan pH; fallback aturan | Posisikan sebagai decision support, bukan pengendali |
| Availability | MQTT presence topic | Presence dipublikasikan, tetapi worker tidak menggunakannya | UI menentukan offline dari usia telemetri 15 detik |
| Skala | Target 200 pelanggan tahun pertama | Belum ada auth, index DB, retention, atau aggregation | Roadmap, bukan kemampuan produksi hari ini |

## Risiko keselamatan paling penting

Dengan konstanta kalibrasi firmware saat ini, input ADC yang putus/short ke ground dapat dipetakan ke nilai pH sangat tinggi lalu dibatasi menjadi 14. Karena pH > 7,5 mengaktifkan solenoid asam, kegagalan probe dapat menyebabkan dosing terus berjalan. Tidak ada batas volume atau timeout untuk mode AUTO.

Jawaban aman ke juri:

> “Untuk prototype, kontrol utama memang berjalan lokal agar tidak bergantung internet, tetapi auto-dosing belum kami klaim production-ready. Uji besok menggunakan cairan aman. Sebelum uji kolam hidup, kami menambahkan validasi sensor, batas dosis per siklus, cooldown pencampuran, emergency stop, dan verifikasi dengan alat referensi.”

## Narasi produk 90 detik

> “Kolam Pintar membantu pembudidaya ikan air tawar mendeteksi perubahan pH sebelum menjadi kerugian. Dari validasi awal kami, masalah yang berulang bukan hanya pH berubah, tetapi perubahan itu terlambat diketahui karena pengecekan masih manual, terutama saat malam atau kolam tidak diawasi. Produk kami menggabungkan sensor pH, ESP32, kontrol lokal, koneksi MQTT, penyimpanan data, dan dashboard web. Nilai utamanya adalah monitoring near-real-time, pencatatan otomatis, dan kontrol yang tetap bekerja ketika internet terputus. Saat ini kami berada pada tahap MVP: alur sensor sampai dashboard sudah terimplementasi, sementara mekanisme dosing kimia masih dalam tahap validasi keselamatan dan kalibrasi lapangan. Model bisnis dirancang fleksibel melalui jual putus dan sewa berlangganan agar pembudidaya kecil-menengah tidak dibebani investasi awal besar. Target uji berikutnya adalah membuktikan akurasi, repeatability, durabilitas, dan dampak ekonomi pada kolam mitra.”

## Arsitektur yang perlu kamu kuasai

```text
pH probe
  ↓ analog
ESP32
  ├─ averaging pembacaan
  ├─ kontrol lokal relay/solenoid
  ├─ LCD
  └─ MQTT telemetry tiap 5 detik
       ↓
EMQX broker
  ↓
Worker TypeScript/Bun
  ├─ validasi pond ID dan payload pH 0–14
  └─ INSERT PostgreSQL
       ↓
Next.js API + dashboard
  ├─ polling data tiap 5 detik
  ├─ grafik/status/jurnal
  ├─ AI atau rule-based summary
  └─ command → MQTT → ESP32
```

Prinsip desain paling kuat: **safety/control loop berada di perangkat, bukan di cloud**. Karena itu internet mati tidak menghentikan kontrol lokal. Cloud berfungsi untuk observability, history, dan perintah operator.

## Demo script 6–8 menit

### 0:00–0:45 — masalah

- Jelaskan keterlambatan monitoring, bukan sekadar “pH buruk”.
- Tunjukkan satu bukti wawancara/survei dan sebut ukuran sampel serta cara pengambilan sampelnya.
- Jangan membuat persentase terdengar representatif nasional jika sampel masih kecil.

### 0:45–1:30 — perangkat

- Tunjukkan probe, ESP32, relay, valve, LCD, dan jalur cairan.
- Sebut fungsi setiap komponen dalam satu kalimat.
- Tegaskan cairan demo aman dan selang kimia belum dipasang ke kolam ikan.

### 1:30–2:30 — alur data

- Ubah nilai simulasi/larutan buffer dan tunjukkan LCD berubah.
- Tunjukkan telemetri masuk ke dashboard dalam 5–10 detik.
- Tunjukkan grafik dan timestamp, bukan hanya angka besar.

### 2:30–3:30 — kontrol dan fail-safe

- Demonstrasikan relay/valve memakai air berwarna.
- Tunjukkan boot state OFF.
- Jika siap, putuskan Wi-Fi dan jelaskan kontrol lokal tetap berjalan.
- Jangan melakukan uji kimia langsung pada ikan.

### 3:30–4:30 — pencatatan dan insight

- Tambahkan jurnal pakan/pengapuran.
- Tunjukkan badge sumber “Gemini” atau “Otomatis”.
- Jelaskan AI tidak pernah mengendalikan valve; AI hanya merangkum data.

### 4:30–5:30 — kualitas

- Tampilkan tabel hasil kalibrasi pH 4 dan pH 7: nilai referensi, nilai sensor, error, dan pengulangan.
- Tampilkan bukti latency, reconnect, dan offline behavior.
- Kalau belum punya data, jujur sebut sebagai rencana uji, bukan hasil.

### 5:30–6:30 — bisnis

- Segmen awal: pembudidaya nila/gurame kecil-menengah dengan beberapa kolam dan monitoring manual.
- Jelaskan dua opsi: jual putus dan sewa, tetapi pastikan tim sepakat apa yang termasuk pada masing-masing paket.
- Tutup dengan milestone 90 hari, bukan visi nasional yang terlalu jauh.

## Test matrix yang sebaiknya dibawa

| Uji | Cara | Bukti yang dibawa | Status minimum besok |
|---|---|---|---|
| Akurasi pH 4 | Buffer pH 4, ≥3 pengulangan | Mean error dan deviasi | Wajib |
| Akurasi pH 7 | Buffer pH 7, ≥3 pengulangan | Mean error dan deviasi | Wajib |
| Repeatability | Larutan sama, 10 pembacaan | Min/max/SD | Wajib |
| Latency | Perubahan sensor → dashboard | Stopwatch/video/log | Wajib |
| Boot fail-safe | Restart perangkat | Relay tetap OFF | Wajib |
| Internet loss | Matikan Wi-Fi | Kontrol lokal tetap hidup | Sangat bagus |
| Broker reconnect | Hidupkan koneksi kembali | Telemetri kembali | Sangat bagus |
| Manual timeout | Buka manual dengan air | Kembali AUTO ≤60 detik | Wajib jika tombol ditunjukkan |
| Probe disconnect | Lepas probe, dosing line aman | Sistem tidak boleh dosing | Saat ini gagal/belum ada guard |
| Stuck sensor | Nilai tetap ekstrem | Alarm/fail-safe | Belum ada |
| Flow calibration | Ukur ml selama 2/5/8 detik | ml/detik aktual | Wajib sebelum klaim volume |
| Cooldown/mixing | Dosing pulse lalu tunggu | Kurva pH setelah tercampur | Belum terimplementasi |
| Waterproofing | Simulasi cipratan terkontrol | Foto/enclosure spec | Jangan diuji tanpa desain aman |
| Command acknowledgement | Klik kontrol → telemetri state | Timestamp requested/applied | Sebagian; belum ada correlation ID |

## Bank pertanyaan juri dan jawaban

### Produk dan kualitas

**1. Produk kalian sebenarnya menyelesaikan masalah apa?**  
Masalah utamanya adalah keterlambatan deteksi dan respons. pH dipilih sebagai parameter MVP karena bisa diukur kontinu dan muncul kuat dalam validasi awal. Kami tidak mengklaim pH adalah satu-satunya penyebab kematian ikan.

**2. Kenapa hanya pH, bukan DO, suhu, amonia, atau kekeruhan?**  
Kami sengaja membatasi MVP agar satu loop sensor–data–kontrol dapat divalidasi dengan baik. DO/suhu/amonia adalah roadmap setelah akurasi, durability, dan value pH terbukti. Menambah sensor sebelum validasi akan menambah biaya dan titik kegagalan.

**3. Apa inovasinya kalau sensor pH sudah banyak?**  
Inovasi bukan pada probe tunggal, tetapi integrasi monitoring kontinu, kontrol lokal yang tidak bergantung internet, histori data, dashboard multi-kolam, dan model layanan yang terjangkau. Pembanding yang tepat adalah proses kerja pembudidaya, bukan hanya harga sensor.

**4. Apakah auto-dosing sudah aman untuk ikan?**  
Belum kami klaim production-ready. Prototype membuktikan control loop dan aktuator. Gate berikutnya adalah sensor validation, maximum dose, cooldown, flow calibration, emergency stop, dan uji kolam bertahap dengan pendamping ahli.

**5. Bagaimana mencegah overdosing?**  
Desain produksi akan memakai pulse dosing, batas dosis per siklus/hari, cooldown pencampuran, validasi beberapa pembacaan, dan fail-safe jika sensor anomali. Code saat ini belum memenuhi seluruh guard tersebut; karena itu demo memakai cairan aman.

**6. Bagaimana kalibrasi sensor?**  
Dua titik menggunakan buffer pH 7 dan pH 4. Probe dibilas, ditunggu stabil, tegangan dicatat, konstanta firmware diperbarui, lalu diverifikasi ulang dengan pengulangan dan alat referensi. Kami juga perlu mencatat tanggal kalibrasi dan drift.

**7. Berapa akurasinya?**  
Jawab hanya dengan data uji yang benar-benar kalian bawa. Format: “Pada buffer X, rata-rata error Y pH dari N pengulangan.” Jangan menjawab spesifikasi vendor sebagai hasil produk.

**8. Apa yang terjadi saat internet mati?**  
Kontrol otomatis tetap berjalan di ESP32. Telemetri dan remote dashboard berhenti sementara, lalu MQTT melakukan reconnect. Ini sengaja agar fungsi kritis tidak bergantung cloud.

**9. Apa yang terjadi saat listrik mati?**  
Relay kembali OFF ketika boot. Saat listrik mati total, monitoring berhenti; roadmap reliability mencakup backup power dan alert power-loss. Jangan mengklaim tetap aktif tanpa UPS/baterai.

**10. Kenapa disebut real-time?**  
Secara produk lebih tepat disebut near-real-time: ESP32 mengirim setiap 5 detik dan dashboard polling setiap 5 detik, sehingga latensi tipikal sekitar 5–10 detik. Control loop lokal berjalan lebih cepat dan tidak menunggu dashboard.

### Teknologi

**11. Kenapa MQTT?**  
MQTT ringan, cocok untuk perangkat terbatas dan jaringan tidak stabil, mendukung pub/sub, QoS, retained presence, dan reconnect. Topik dipisahkan per pond untuk telemetri, kontrol, dan status.

**12. Bagaimana aliran data?**  
ESP32 → topic sensor → EMQX → worker → validasi → PostgreSQL → Next.js API → dashboard. Perintah berjalan balik dari dashboard → API → MQTT control topic → ESP32 → dikonfirmasi lewat telemetri berikutnya.

**13. Apakah AI mengendalikan solenoid?**  
Tidak. Kontrol memakai aturan deterministik pada ESP32. AI hanya merangkum tren pH untuk decision support. Jika Gemini tidak tersedia, fallback rule-based tetap bekerja.

**14. Mengapa AI dibutuhkan kalau hanya pH?**  
Pada MVP, AI bukan core value dan tidak boleh dibesar-besarkan. Nilainya adalah menyederhanakan interpretasi histori bagi pengguna nonteknis. Core product tetap monitoring, alert, history, dan control safety.

**15. Bagaimana memastikan perintah dashboard berhasil?**  
Saat ini API memastikan publish ke broker berhasil, lalu dashboard menunggu telemetri state perangkat. Versi produksi akan menambah command ID, acknowledgement, timeout, dan audit requested-vs-applied.

**16. Bagaimana keamanan sistem?**  
Prototype berjalan pada trusted local network. Produksi membutuhkan akun pengguna, otorisasi per kolam, device credentials unik, MQTT over TLS, rate limiting, secret rotation, dan broker/database yang tidak diekspos publik.

**17. Bagaimana skala 200 pelanggan?**  
Pada interval 5 detik, 200 perangkat menghasilkan sekitar 3,456 juta baris per hari atau 1,261 miliar per tahun. Sebelum scale-up kami perlu index `(pond_id, created_at)`, retention policy, downsampling/time-series storage, aggregation, dan observability. Target 200 adalah target bisnis, bukan kapasitas produksi yang sudah terbukti.

**18. Kenapa PostgreSQL?**  
Cukup cepat dan sederhana untuk MVP, mendukung query histori dan transaksi jurnal/control log. Saat volume naik, PostgreSQL bisa diperkuat dengan index, partitioning, retention, atau extension time-series sebelum mempertimbangkan sistem lain.

**19. Bagaimana data dipisahkan antar pelanggan?**  
Belum ada multi-tenancy pada prototype. Production design membutuhkan tabel user–farm–pond–device dan setiap API query harus dibatasi oleh identitas pengguna.

**20. Apakah code siap production?**  
Build production sudah lolos, tetapi sistem sebagai keseluruhan masih MVP. Auth, TLS, test automation, dosing safety, retention, device provisioning, dan uji lapangan belum selesai.

### Bisnis

**21. Siapa beachhead market kalian?**  
Pembudidaya nila/gurame kecil-menengah yang memiliki lebih dari satu kolam, masih monitoring manual, memiliki listrik/smartphone, dan pernah mengalami keterlambatan deteksi. Fokus awal geografis mengikuti akses kolam mitra, bukan langsung nasional.

**22. Dari mana angka pasar 950 ribu?**  
BPS Sensus Pertanian 2023 mencatat 950.106 pelaku usaha pertanian perorangan pembudidaya ikan. Itu TAM tingkat pelaku, bukan jumlah pelanggan realistis. SAM/SOM harus disaring menurut komoditas, wilayah, tipe kolam, konektivitas, dan willingness to pay.

**23. Berapa responden validasi?**  
Jawab dengan N yang benar, lokasi, metode, dan profil responden. Jika N kecil, katakan “validasi awal kualitatif”, bukan survei representatif nasional. Bawa raw response atau ringkasan anonim.

**24. Mengapa Rp179.000 per bulan?**  
Jawaban harus menghubungkan willingness to pay, biaya hardware, hosting, maintenance, dan nilai kerugian yang dihindari. Jangan hanya mengatakan “terjangkau”. Jelaskan apa yang termasuk dan tidak termasuk.

**25. Apa beda Standard dan Premium?**  
Tim harus menyepakati sebelum masuk. Rekomendasi: Standard = monitoring, history, visual alert, support; Premium = perangkat + instalasi + maintenance dan, setelah tervalidasi, auto-correction. Jangan menjual fitur dosing yang belum lolos safety gate.

**26. Bagaimana BEP 8–10 bulan dihitung?**  
Tunjukkan arus kas bulanan: jumlah unit jual/sewa, revenue per unit, COGS, hosting, instalasi, maintenance, CAC, churn, dan working capital. Tujuh langganan menghasilkan Rp15.036.000 omzet tahunan, tetapi omzet bukan laba dan bukan otomatis payback.

**27. Berapa biaya hardware?**  
Anggaran PMW untuk 10 unit komponen adalah Rp5.873.000, sekitar Rp587.300/unit, belum termasuk alokasi bahan perakitan, kalibrasi, tenaga, packaging, instalasi, garansi, dan retur. Harga jual sekitar Rp1 juta perlu dihitung dengan semua biaya tersebut.

**28. Kenapa anggaran Figma Pro Rp3.168.000 lebih besar dari sensor pH?**  
Ini pertanyaan sulit yang valid. Jawaban terbaik adalah mengakui prioritas quality harus pada kalibrasi, enclosure, safety, dan uji lapangan. Jika anggaran belum final, evaluasi kembali alokasi software design dan tunjukkan perubahan yang lebih dekat ke milestone produk.

**29. Bagaimana mencapai 200 pelanggan dengan hanya 10 unit awal?**  
Sepuluh unit adalah batch validasi, bukan stok untuk 200 pelanggan. Pertumbuhan harus berbasis gate: 10 pilot → bukti reliability/value → mitra komunitas → pembiayaan working capital → batch berikutnya. Target 200 perlu disertai kapasitas produksi dan support.

**30. Apa traction aktual hari ini?**  
Pisahkan: jumlah wawancara/survei, LOI, kolam pilot, unit terakit, jam operasional, data telemetri, dan pelanggan bayar. Tabel 200 pelanggan/CRP 65% adalah proyeksi. Jangan menyebutnya traction aktual.

**31. Kenapa pembudidaya tidak cukup memakai pH meter manual?**  
pH meter manual murah dan tetap menjadi kompetitor utama. Kolam Pintar layak jika continuous monitoring, alert, histori, dan pengurangan kunjungan manual memberi nilai lebih besar dari biaya langganan. Ini harus dibuktikan dalam pilot.

**32. Apa moat kalian?**  
Bukan komponen ESP32. Moat yang mungkin dibangun adalah dataset kolam lokal, reliability lapangan, SOP instalasi/kalibrasi, jaringan komunitas, layanan purna jual, dan bukti outcome ekonomi.

**33. Bagaimana jika eFishery kembali/kompetitor besar masuk?**  
Jangan bergantung pada kabar berhentinya kompetitor. Fokus pada wedge spesifik: kualitas air pH, smallholder affordability, local service, dan kontrol yang tetap lokal. Validasi value lebih penting daripada narasi kompetitor gagal.

### Tim dan eksekusi

**34. Mengapa tim ini mampu mengeksekusi?**  
Jawab dengan pembagian bukti: IoT engineer memegang kalibrasi/hardware, CTO integrasi dan reliability, COO instalasi/SOP, CFO unit economics, CEO pilot/partnership. Jangan hanya menyebut jabatan dan lomba.

**35. Apa milestone 90 hari?**  
Contoh: 10 unit prototype; kalibrasi dua titik dan repeatability; fail-safe dan pulse dosing; 2–3 kolam pilot; data uptime/latency; satu model harga tervalidasi; SOP instalasi/maintenance; minimal satu LOI atau pelanggan bayar.

## Data dan dokumen yang perlu dibawa

- Raw survey anonim + ringkasan metode (N, lokasi, komoditas, ukuran usaha).
- 2–3 kutipan wawancara dengan izin dan konteks.
- Tabel kalibrasi dan repeatability.
- Video demo offline/reconnect jika jaringan lokasi gagal.
- Foto wiring dan diagram sistem.
- BOM per unit dan unit economics.
- Cash-flow bulanan yang menghasilkan BEP 8–10 bulan.
- Bukti status prototype: unit terakit, jam uji, lokasi pilot, dan issue log.
- Backup hotspot, kabel, adaptor, extension, cairan aman, tissue, multimeter, pH buffer, alat referensi.

## Redaksi yang harus dihindari

| Hindari | Ganti dengan |
|---|---|
| “Sudah terbukti mencegah kematian ikan” | “Hipotesis dampak yang akan kami ukur pada pilot” |
| “Real-time tanpa delay” | “Near-real-time 5–10 detik; kontrol lokal tidak menunggu cloud” |
| “AI menentukan dosing” | “AI merangkum; dosing memakai aturan deterministik lokal” |
| “Sistem aman” | “Prototype memiliki boot OFF dan local control; safety guard tambahan masih roadmap” |
| “200 pelanggan” sebagai traction | “Target tahun pertama setelah pilot” |
| “8 dari 10 berarti 80% pasar” | “8 dari 10 responden validasi awal” |
| “eFishery sudah tutup” | “Operasional lapangan dilaporkan berhenti pada 2025; positioning kami tidak bergantung pada itu” |
| “Produk siap pasar” | “MVP siap diuji; production readiness memiliki quality gates” |

## Masalah dokumen PMW yang harus dicek

- Link awal menunjuk tab P2MW; gunakan tab **Proposal Fix - PMW** untuk besok.
- Kolom “Judul Kegiatan” pada lembar pengesahan masih kosong.
- Lembar PMW masih menulis “Sumber lain dana P2MW”.
- NIM Leandro berbeda: `1710624067` pada cover/pengesahan vs `1710625067` pada biodata.
- Email Leandro berbeda antara lembar pengesahan dan biodata.
- Istilah “peternak” dan “pembudidaya” perlu diseragamkan menjadi “pembudidaya”.
- Tabel proyeksi pelanggan harus diberi label **proyeksi/target**, bukan traction aktual.
- Istilah CRP sebaiknya dijelaskan; metrik standar adalah customer retention rate, dengan definisi cohort yang jelas.
- Klaim 2,21% volume vs 0,04% nilai adalah data total perikanan, bukan bukti inefisiensi budidaya. Data KKP yang sama menunjukkan budidaya tumbuh 2,61% volume dan 2,89% nilai.
- Proposal menganggarkan botol 100 ml tetapi tabel dosing memiliki dosis hingga 150 ml.
- Alokasi Figma Pro Rp3.168.000 perlu justifikasi kuat atau evaluasi prioritas.
- Tidak ada item buffer kalibrasi, alat referensi, flow meter, emergency stop, gland/enclosure ber-rating, sensor level, atau uji laboratorium meski narasi menekankan kualitas dan durabilitas.
- Paket Standard/Premium disebut tetapi scope, harga, SLA, maintenance, dan ownership hardware belum tegas.

## Pembagian briefing tim

- **CEO:** problem, validation evidence, positioning, pilot, partnership, 90-day milestone.
- **IoT Engineer:** kalibrasi, wiring, actuator, flow rate, failure mode, safety gates.
- **CTO:** arsitektur, offline behavior, MQTT, database, AI boundary, security, scaling.
- **CFO:** BOM, package inclusion, gross margin, BEP, cash flow, assumptions.
- **COO:** perakitan, SOP instalasi, maintenance, spare part, warranty, support capacity.

Setiap anggota harus bisa menjawab tiga hal yang sama: **produk ada di tahap apa, apa yang sudah terbukti, dan apa quality gate berikutnya.**

## Checklist malam ini dan besok pagi

### Malam ini

- [ ] Tentukan arah kimia: pH UP atau asam; samakan proposal, firmware, dashboard, label botol, dan ucapan tim.
- [ ] Jika belum sempat menyelaraskan secara aman, nonaktifkan/diskonek dosing kimia dan demo dengan air.
- [ ] Perbaiki identitas dan label P2MW/PMW di proposal.
- [ ] Bawa tabel kalibrasi dan hasil uji, meski sederhana.
- [ ] Sepakati definisi paket dan isi Rp179.000/bulan.
- [ ] Siapkan cash-flow pembentuk BEP.
- [ ] Tandai target 200 dan CRP sebagai proyeksi.
- [ ] Rekam video demo end-to-end dan offline fallback.
- [ ] Jalankan `docker-compose up --build` pada laptop demo dan pastikan empat service healthy.
- [ ] Pastikan data demo masuk sebelum berangkat; siapkan data/video cadangan tanpa memalsukan hasil.

### Besok pagi

- [ ] Kalibrasi ulang dan foto nilai buffer.
- [ ] Uji boot OFF, manual timeout, reconnect, dan dashboard.
- [ ] Cek valve polarity dengan selang aman.
- [ ] Pastikan semua botol diberi label jelas dan tidak ada cairan berbahaya terbuka.
- [ ] Matikan auto-dosing kimia jika guard keselamatan belum siap.
- [ ] Bawa hotspot, power strip, adaptor cadangan, kabel USB, multimeter, tissue, dan cairan demo.
- [ ] Lakukan latihan 10 pertanyaan tersulit tanpa membaca catatan.

## Referensi fakta eksternal yang sudah diverifikasi

- BPS Sensus Pertanian 2023: 950.106 pelaku usaha pertanian perorangan pembudidaya ikan — https://sensus.bps.go.id/topik/tabular/st2023/233/0/0
- KKP Rilis Data Triwulan I 2025: total perikanan +2,21% volume dan +0,04% nilai; khusus budidaya +2,61% volume dan +2,89% nilai — https://ppid.kkp.go.id/media/uploads/document_information_public/Rilis_Data_Kelautan_dan_Perikanan_Triwulan_I__2025.pdf
- UNJ menjelaskan Product & Quality Test sebagai tahap pengujian kesiapan produk dari sisi kualitas dan kelayakan — https://fis.unj.ac.id/ikom/?p=2636
- Riset tilapia menunjukkan rentang pH yang cocok bervariasi menurut konteks; satu studi lapangan menyebut ideal 6–9, sehingga threshold harus dikaitkan ke spesies, fase, dan kondisi kolam — https://link.springer.com/article/10.1186/s41240-017-0075-7

