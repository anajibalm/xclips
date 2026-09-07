# 🎬 xClips — Smart Video Clipper & Short-Form Studio

[![Status: Beta](https://img.shields.io/badge/Status-Beta_v1.0.0-orange?style=flat-square)](https://github.com/egga-fx/xclips)
[![Platform](https://img.shields.io/badge/Platform-Windows_x64-blue?style=flat-square)](https://github.com/egga-fx/xclips)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun_v1.2+-black?style=flat-square&logo=bun)](https://bun.sh/)
[![Framework: Next.js + Tauri](https://img.shields.io/badge/Framework-Next.js_16_%7C_Tauri_v2-black?style=flat-square)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

**xClips** adalah aplikasi studio desktop berkinerja tinggi (*high-performance desktop clipper*) yang dirancang untuk memotong, membersihkan, merestrukturisasi, dan mengoptimalkan video berdurasi panjang (podcast, webinar, materi edukasi, streaming, YouTube/TikTok) menjadi video pendek (*short-form content* vertikal 9:16) berkualitas tinggi yang siap dipublikasikan ke TikTok, Instagram Reels, dan YouTube Shorts.

---

> [!WARNING]
> ### 🚧 Masih Dalam Tahap Beta (v1.0.0-beta)
> Proyek ini saat ini berada dalam **tahap pengembangan aktif (Beta)**:
> - Fitur, antarmuka pengguna (UI), dan API internal masih dapat mengalami perubahan atau pembaruan.
> - Fokus stabilitas dan akselerasi saat ini dioptimalkan untuk platform **Windows 10/11 x64**.
> - Jika Anda menemukan kendala teknis, bug, atau memiliki saran fitur, silakan buka laporan di [GitHub Issues](https://github.com/egga-fx/xclips/issues).

---

## 🎯 Tujuan Proyek

Mengedit rekaman video berdurasi 1–2 jam secara manual untuk mencari 30 detik momen emas membutuhkan waktu berjam-jam, membebani kuota jika harus diunggah ke cloud, serta memerlukan software editing yang rumit. **xClips** hadir untuk menyelesaikan masalah tersebut dengan pendekatan:

1. **Local-First & Privasi Terjaga**: File video berat (1080p/4K) diolah **100% lokal** di mesin pengguna memanfaatkan akselerasi GPU (NVENC/QSV/AMF) via FFmpeg native. Video tidak diunggah ke server cloud; hanya transkrip atau audio chunk ringan yang dikirim ke AI.
2. **AI Semantic Highlighting & Hook Scorer**: Menggunakan model LLM efisien (Gemini Flash) untuk membedah topik dan merekomendasikan klip dengan potensi viral tertinggi dalam <60 detik.
3. **Pembersihan Filler Words Bahasa Indonesia**: Deteksi otomatis kata jeda (*"ee"*, *"hm"*, *"apa namanya"*, *"begitu ya"*) berbasis token kamus lokal dengan pemotongan non-destruktif dan *audio micro-crossfade*.
4. **Dynamic Karaoke Subtitles**: Generator takarir otomatis per-kata (*word-level timestamps*) bergaya modern (Hormozi/Submagic style) dengan kustomisasi font, warna, dan animasi pop-in.
5. **Smart 9:16 Re-framing**: Mengubah video lanskap 16:9 menjadi vertikal 9:16 secara instan dengan preset *Center Crop (dengan manual pan)*, *Blurred Background Fit*, dan *Split-Screen Stack*.

---

## 🛠️ Stack Dasar

| Lapisan / Komponen | Teknologi | Keterangan |
| :--- | :--- | :--- |
| **Desktop Shell** | **Tauri v2** + **Rust** | Shell desktop ringan dengan konsumsi memori minim dan akses native OS |
| **Frontend UI** | **Next.js 16** (App Router, Static Export) | Antarmuka pengguna berbasis React 19 & TypeScript |
| **Design System** | **Material UI (MUI) v9.3** | *Masagi Zinc Dark Theme* dengan layout dual-pane responsif |
| **Timeline Audio** | **Wavesurfer.js v7** | Visualisasi waveform interaktif untuk pemotongan audio presisi |
| **State Management** | **Zustand v5** | Pengelolaan state UI klien yang cepat dan modular |
| **API Backend** | **Hono v4** (`@hono/node-server`) | Server HTTP lokal super cepat berjalan di runtime Bun |
| **Runtime & Test** | **Bun (v1.2+)** | Runtime JavaScript/TypeScript, package manager, dan test runner |
| **Database** | **SQLite** (`bun:sqlite`) | Database embedded berkecepatan tinggi dengan mode **WAL** |
| **Media Processing** | **FFmpeg** & **FFprobe** | Engine lokal untuk decoding, encoding GPU, VFR-to-CFR, dan framing |
| **Downloader Engine** | **yt-dlp** & Custom Scraper | Pengunduh media web universal (YouTube, TikTok, Instagram, X, Pinterest) |
| **AI Cloud Layer** | **Gemini 3.6 / KIE Flash** | Skoring semantik, transkripsi cerdas, dan deteksi timestamp per kata |

---

## 💻 Cara Development

### 1. Prasyarat Sistem
Pastikan perangkat Anda telah terpasang:
- [Bun](https://bun.sh/) (versi 1.2 atau lebih baru)
- [FFmpeg](https://ffmpeg.org/) dan **FFprobe** (terpasang di PATH sistem)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (opsional, disarankan di PATH untuk fitur unduh URL video)
- [Rust & Cargo](https://www.rust-lang.org/) *(hanya diperlukan jika mengembangkan Desktop Shell Tauri)*

### 2. Kloning & Instalasi Dependensi
```bash
# Clone repositori
git clone https://github.com/egga-fx/xclips.git
cd xclips

# Instal dependensi menggunakan Bun
bun install
```

### 3. Konfigurasi Lingkungan
Salin file konfigurasi lingkungan dasar:
```bash
cp .env.example .env
```
> [!NOTE]
> Kredensial AI Provider (misal: Google Gemini API Key) disimpan secara lokal di file `vault/xclips/settings.json` demi keamanan data pengguna.

### 4. Menjalankan Server Development

#### A. Menjalankan Web UI & API Sekaligus (Rekomendasi)
```bash
bun run dev:all
```
Perintah ini menjalankan dua proses secara bersamaan:
- **Web UI** (Next.js): `http://localhost:3350`
- **API Server** (Hono): `http://localhost:3351`

#### B. Menjalankan Secara Terpisah
Jika ingin memantau log per modul di terminal terpisah:
```bash
# Terminal 1 — Frontend Web UI
bun run dev

# Terminal 2 — Backend Hono API (dengan auto-reload)
bun run dev:api
```

#### C. Menjalankan Desktop Shell (Tauri v2)
Untuk menguji aplikasi dalam window desktop native Windows:
```bash
bun run tauri:dev
```

### 5. Port Mapping & Lokasi Data
| Layanan / Resource | Port / Alamat | Keterangan |
| :--- | :--- | :--- |
| **Web UI** | `3350` | Antarmuka Next.js Studio |
| **API Server** | `3351` | Endpoint Hono lokal (`/api/xclips/*`) |
| **Database File** | `vault/xclips/xclips.db` | SQLite database (WAL mode) |
| **Settings Vault** | `vault/xclips/settings.json` | Konfigurasi lokal dan API keys |
| **Render Cache** | `vault/xclips/cache/` | Cache potongan video & transkrip |

### 6. Menjalankan Pengujian (Testing)
Pastikan seluruh invariant dan fitur berfungsi normal melalui test runner bawaan Bun:
```bash
# Jalankan seluruh test suite
bun test

# Jalankan test spesifik modul
bun test tests/xclips/ytdlp-downloader.test.ts
bun test tests/xclips/filler-detector.test.ts
bun test tests/xclips/ffmpeg-builder.test.ts

# Pemeriksaan Type Checking TypeScript
bun x tsc --noEmit
```

### 7. Build Produksi
```bash
# 1. Build static export Next.js ke direktori out/
bun run build

# 2. Kompilasi installer native desktop (.exe / .msi) via Tauri
bun run tauri:build
```

---

## 📄 Lisensi

Proyek ini didistribusikan di bawah lisensi terbuka **MIT License**. Silakan baca file [LICENSE](./LICENSE) untuk ketentuan lengkapnya.
