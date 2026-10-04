# Demo expo Kolam Pintar

Branch: `codex/expo-demo`. Halaman yang dipakai tetap `/kolam`, dengan redirect dari `/`.

## Coba dengan ESP32

1. Jalankan `docker compose up -d --build` dari root proyek. Buka <http://localhost:3000>.
2. Buka `hardware/esp32-kolampintar/esp32-kolampintar.ino` di Arduino IDE. Salin `secrets.example.h` menjadi `secrets.h`, lalu isi Wi-Fi dan MQTT sesuai panduan hardware. `MQTT_HOST` harus IP LAN komputer server, bukan `localhost`.
3. Pastikan file `demo-sequence.h` berada di folder sketch yang sama. Upload **sketch dari branch ini**. Firmware langsung menjalankan data simulasi; sensor pH tidak dibaca dan kontrol dosing/asam asli tidak dijalankan.
4. Untuk demonstrasi valve, lepaskan bahan koreksi pH. Gunakan jalur air biasa terpisah bila ingin menunjukkan aliran. Periksa pin relay 26, polaritas active-low, dan perilaku valve fisik.
5. Dari daftar kolam, klik **Buka kolam** pada perangkat demo. Dashboard mempertahankan kartu kondisi, grafik pH, insight, jurnal, dan susunan panel sebelumnya. Kontrol expo menggantikan tombol kontrol aliran lama pada panel **Kontrol demo expo**. Tunggu indikator terhubung. Nilai awal adalah pH simulasi 7,5 dan valve tertutup.
6. Panel kontrol menjelaskan tahap saat ini dan langkah berikutnya, termasuk akibat dan waktunya. Tekan **Mulai: pemberian pakan** sambil memperagakan pakan, lalu **Simulasikan pH rendah**. Saat popup muncul, tekan **Buka valve demo · 3 detik** langsung di popup; tombol yang sama juga tersedia di panel.
7. Valve ditutup otomatis setelah 3 detik. Pemulihan pH simulasi dari sekitar 6,0 kembali ke baseline normal sekitar 7,5 berlangsung 4 detik. Tahap valve/pemulihan berjalan otomatis dan tombol utama menjelaskan proses yang sedang ditunggu. Setelah kembali normal, **Selesai demo · lanjut ke game** menampilkan ajakan bermain.
8. **Reset** mengembalikan kondisi normal. **Hentikan** menutup valve dan menghentikan cerita. **Jeda** menutup valve; jika dijeda pada tahap valve aktif, resume melanjutkan pemulihan tanpa membuka valve lagi.

Firmware ditentukan oleh sketch yang terakhir di-upload, bukan oleh branch yang sedang dipilih di komputer. Untuk kembali ke kontrol sensor asli, upload kembali firmware dari branch utama.

Angka pH simulasi bergerak pada setiap sampel 500 ms. Baseline normal bergerak perlahan dan acak sekitar 7,5, dengan envelope 7,2–7,8, drift yang berkorelasi, serta noise pengukuran kecil. Sinyal tidak mengunjungi seluruh rentang pada setiap putaran dan tidak berulang seperti gelombang. Tahap pakan bergerak menuju 7,0 selama 6 detik; tahap pH rendah turun bertahap menuju 6,0 selama 4 detik sehingga melewati batas alert 6,5. Pergantian tahap mempertahankan nilai sebelumnya agar tidak meloncat. Pemulihan memakai kurva halus selama 4 detik dan kembali ke baseline normal. Jeda membekukan sampel. Grafik memakai skala 5,8–8,8 dan menunjukkan batas demo 6,5–8,5; kartu status dan ringkasan memakai rentang yang sama. Ini tetap sinyal sintetis dengan waktu dipercepat untuk expo, bukan model yang dikalibrasi terhadap kolam aktual.

Peringatan suara otomatis, tanpa tombol aktivasi atau bisukan. Saat pH turun di bawah 6,5, panel berubah merah dan popup muncul dengan lampu merah bergantian serta suara sirene naik-turun 480–960 Hz setiap 1,5 detik. Tombol popup **Buka valve demo · 3 detik** mengirim tindakan yang sama dengan panel, menunggu konfirmasi perangkat, dan menampilkan kegagalan agar bisa dicoba kembali. Menutup popup atau Escape tidak mematikan sirene; popup muncul lagi setelah 10 detik jika pH masih rendah dan belum ada respons. Tidak ada tombol untuk membuka popup secara manual. Setelah respons valve dikonfirmasi, popup ditutup dan pengingat tidak muncul selama valve/pemulihan berlangsung. Browser yang membatasi autoplay akan mengizinkan audio pada klik/tap atau interaksi keyboard pertama di halaman, termasuk tombol mulai demo. Peringatan baru pulih pada pH 6,6 agar noise di sekitar batas tidak memicu on/off berulang. Popup dan audio berhenti saat demo dijeda/dihentikan/reset, pH pulih, halaman ditinggalkan, koneksi terputus, atau sampel berumur 5 detik. Preferensi reduced motion menonaktifkan animasi lampu dan ikon.

## Alur data

```text
Kontrol crew di dashboard
  → POST /api/control → MQTT device/{uid}/control
  → urutan demo pada ESP32 → GPIO relay/valve
  → acknowledgement dan telemetri setiap 500 ms
  → worker → PostgreSQL → dashboard
```

Tahap yang dikirim firmware: `NORMAL → FOOD → DANGER → ACTIVE → RECOVERY → RESTORED → READY`. `STOPPED` adalah keadaan setelah hentikan. Tidak ada transisi optimistis di browser: layar mengikuti telemetri perangkat. Crew mengendalikan perpindahan cerita; penutupan valve dan pemulihan memakai timer perangkat.

Nilai pH selalu ditandai sebagai simulasi. Data tersimpan dengan `data_source = SIMULATION`; data lama tetap tanpa penanda tersebut. Gunakan database/volume expo tersendiri jika ingin memisahkan riwayat dari data operasional. Branch Git tidak memisahkan isi database.

ACK membuktikan perintah diterapkan dan level GPIO saat itu, bukan aliran cairan. Telemetri terlalu lama atau koneksi server gagal membuat tampilan status valve menjadi belum diketahui.

## Perilaku ketika ada gangguan

- Boot: GPIO valve OFF dan kondisi NORMAL.
- Valve memakai timer ESP independen untuk menutup GPIO setelah 3 detik, termasuk saat panggilan jaringan tertahan. Tidak ada retry koneksi MQTT saat valve aktif.
- Koneksi putus tidak menghentikan timer lokal; kondisi terbaru dipublikasikan kembali saat terhubung.
- Session boot dan revision tahap dibawa dalam perintah untuk menolak transisi dari sesi/tahap lama. Duplikat command terakhir mengirim ACK ulang tanpa membuka valve lagi.
- Reset/hentikan dapat dikirim tanpa session/revision terkini dan menggantikan perintah dashboard yang masih menunggu ACK.
- Perintah kontrol sensor lama (`AUTO`/`MANUAL ON`) tidak diterima oleh API expo atau firmware ini.

## Uji perangkat tanpa ESP32

Adapter pengujian MQTT menggunakan **header C++ yang sama** dengan sketch; adapter ini tidak membuktikan wiring, kompilasi Arduino, timer ESP, atau valve fisik.

Di PowerShell dari root proyek, dengan compiler G++ yang tersedia:

```powershell
# Jika memakai MSYS2 UCRT64, sertakan folder DLL compiler di PATH.
$env:PATH = "C:/msys64/ucrt64/bin;" + $env:PATH
g++ -std=c++11 hardware/esp32-kolampintar/tests/demo-sequence.cpp -o hardware/esp32-kolampintar/tests/demo-sequence-test.exe
./hardware/esp32-kolampintar/tests/demo-sequence-test.exe
g++ -std=c++11 hardware/esp32-kolampintar/tests/demo-bridge.cpp -o hardware/esp32-kolampintar/tests/demo-bridge.exe
```

Kemudian di terminal terpisah, dari `apps/worker`:

```powershell
bun run simulate:expo
```

Perangkat uji default adalah `E0F000000001`. Dengan simulator masih berjalan, di terminal lain dari `apps/worker`:

```powershell
bun run test:expo
```

Tes ini menjalankan 10 putaran lengkap, stale command, pause/resume, reset, dan hentikan saat valve aktif. Jangan mengendalikan perangkat uji yang sama dari browser saat tes otomatis sedang berjalan. Ctrl+C menghentikan adapter.

Tes acknowledgement bisa dijalankan dalam jaringan Docker, dari root proyek:

```powershell
docker compose run --rm --no-deps -e API_URL=http://web:3000 -v "${PWD}/apps/worker/integration:/app/integration:ro" worker bun integration/command-ack.ts
```

## Sebelum booth dibuka

- Upload sketch expo, cek LCD bertuliskan DEMO, dan cocokkan UID perangkat.
- Periksa valve benar-benar membuka lalu menutup dengan air biasa pada jalur terpisah.
- Uji reset/hentikan saat valve terbuka, boot ulang, serta putus jaringan pada tahap ACTIVE.
- Jalankan demo beberapa putaran dengan penjelasan crew. Angka pH dan pemulihan dipercepat; jangan menyebutnya pembacaan sensor aktual.

Verifikasi pada 4 Oktober 2026: build produksi Docker, typecheck web/worker, 17 unit test awal, tes C++ urutan, 10 putaran integrasi demo melalui MQTT, integrasi acknowledgement, dan browser desktop/mobile semuanya lolos. Sketch terbaru juga berhasil dikompilasi dengan `esp32:esp32:esp32` pada core 3.3.10: flash 949.672 byte (72%) dan RAM 48.752 byte (14%). Kompilasi memakai konfigurasi placeholder, tanpa upload. Upload dan pengujian pada ESP32 fisik masih perlu dilakukan.

Pembaruan fluktuasi acak dan audio: 9 unit test web termasuk ambang alert/histeresis lolos. Tes C++ memeriksa batas variasi, perubahan antar-sampel, konsistensi pada frekuensi loop berbeda, transisi halus, jeda, serta timeout valve. Uji MQTT mendeteksi 4 angka tampilan berbeda dalam 10 sampel, lalu satu putaran lengkap beserta pause/resume, reset, dan hentikan lolos. Instrumentasi Web Audio di browser mencatat dua oscillator dalam status running saat pH rendah; jeda dan pemulihan menghentikan pemutaran berkala. Tampilan ponsel 390 px tidak overflow dan browser tidak mencatat error. Keluaran audio perangkat/speaker fisik tetap perlu dicek sebelum booth dibuka.

Pembaruan audio otomatis: build Docker dan 9 unit test web lolos. Browser memicu audio lewat tombol demo biasa, tanpa tombol aktivasi. Interval antar-pasangan beep terukur 1.503, 1.501, dan 1.502 ms. Jeda serta reset menghentikan audio; tidak ada error browser atau overflow ponsel.

Pembaruan popup sirene: build Docker dan unit test web lolos. Browser mengonfirmasi dialog modal, fokus keyboard, Escape serta pengembalian fokus, dan popup yang tidak muncul berulang setelah ditutup. Web Audio menjalankan sweep 480–960–480 Hz. Pemulihan pH menutup popup dan menghentikan sirene; kejadian rendah berikutnya membuka popup lagi. Tampilan ponsel 390 px tidak overflow. Adapter uji MQTT dipastikan hanya satu agar status demo tidak bertabrakan.

Pembaruan rentang normal 7,2–7,8: tes C++ menguji delapan seed selama masing-masing sepuluh menit simulasi, batas perubahan antar-sampel, penurunan, dan pemulihan. Satu putaran MQTT beserta stale command, pause/resume, stop, dan reset lolos; pengujian memastikan pH rendah benar-benar melewati 6,5 sebelum valve diperagakan dan status normal tidak menjadi peringatan tinggi. Browser memunculkan popup sekitar pH 6,02, kemudian pulih sekitar 7,45 dengan popup tertutup dan status normal. Build Docker, 9 unit test web, dan pemeriksaan ponsel tanpa overflow/error lolos.

Pembaruan panduan crew dan aksi popup: build Docker, typecheck, dan 9 unit test web lolos. Uji browser memastikan popup ditutup, tetap tertutup pada 4 detik, dan muncul kembali setelah 10 detik tanpa tindakan; tombol pembuka popup manual tidak ada. Klik ganda pada aksi popup hanya menghasilkan satu perintah NEXT; telemetri mengonfirmasi ACTIVE/ON dan popup tertutup, lalu RESTORED tanpa pengingat ulang. Simulasi respons HTTP gagal menjaga popup tetap terbuka, valve OFF, pesan error terlihat, dan tombol retry aktif; percobaan ulang berhasil. Panduan tahap normal, pakan, dan game serta layar ponsel 390 px diperiksa tanpa overflow/error. Antrean perintah popup/panel memakai hook yang sama, termasuk pembatalan saat pindah kolam dan prioritas reset/hentikan.


Pembaruan layout monitor expo: pH, status valve, grafik, dan kontrol disusun dua kolom pada desktop; kontrol tetap terlihat saat scroll. Detail perangkat, AI, dan jurnal berada di bawah informasi utama. Bantuan tombol tersedia lewat disclosure. Dua pemeriksaan layout independen dilakukan; scan layout tidak menemukan temuan. Browser 1280×720 dan 1366×768 menampilkan seluruh area utama dan kontrol tanpa scroll awal. Tampilan HP 390 px tidak overflow. Alur jeda/lanjut, popup pH rendah, aksi valve dari popup, dan pemulihan diverifikasi dengan adapter MQTT C++. Build Docker, typecheck, dan 9 test web lolos. Video sebelumnya masih memakai layout sebelum pembaruan ini.
