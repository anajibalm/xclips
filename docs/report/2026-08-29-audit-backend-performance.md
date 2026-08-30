# Audit: Backend & Performance — xclips API Server, DB, Render Queue & Media Pipeline

**Date**: 2026-08-29
**Scope**: Sisi backend & performance menyeluruh (bukan hanya jalur subtitle) — seluruh Hono API server, SQLite engine, render queue, media streaming, logging, dan live runtime.
**Status**: DONE (audit read-only, tanpa perubahan kode)
**Related**: Laporan fitur subtitle/transkrip/sinkronisasi ada di `docs/report/2026-08-29-audit-subtitle-transcript-sync.md` (Part 1 & 2, 37 findings). Laporan ini adalah Part 3 yang dipecah menjadi dokumen mandiri.

**Files audited**:
- `src/server/index.ts` (1191 LOC — seluruh routes: ingest, streaming, assets, thumbnail, logs, subtitle/transcript, clips, settings)
- `src/lib/xclips/xclips-db.ts` (624 LOC — schema, pragmas, migration, prepared statements, semua CRUD)
- `src/lib/xclips/queue.ts` (245 LOC — render queue, hwaccel, progress)
- `src/lib/logger.ts` (pino config: transports, level)
- `src/app/xclips/studio/tabs/TabLogs.tsx` (polling interval logs)
- `src/lib/api-client.ts` (apiFetch)
- Live runtime: `netstat` (bind 0.0.0.0:3350/3351 aktif), ukuran `logs/app.log` (179 KB / ~1 hari)

---

## Findings Summary

| # | Severity | Lokasi | Issue | Remediation |
|---|----------|--------|-------|-------------|
| B-P0-1 | 🔴 P0 | `server/index.ts` + `useStudioStore.ts:632` | PUT `/api/xclips/clips/:id` tidak ada — save clip 404 silent, styling subtitle tidak pernah persist | Tambah route PUT + cek `res.ok` di `handleSaveClip` |
| B-P0-2 | 🔴 P0 | `useStudioStore.ts:583` | `GET /api/xclips/settings/models` 404 — model list AI tidak pernah live, jatuh ke fallback hardcoded | Ganti ke `POST /api/xclips/ai/models` yang sudah ada |
| B-P0-3 | 🔴 P0 | `server/index.ts:18-27` | CORS reflect-any-origin + credentials, listen 0.0.0.0 (terverifikasi) — API callable dari tab malicious di LAN/Tailscale | Whitelist origin localhost/Tailscale, drop credentials |
| B-P1-4 | 🟠 P1 | `server/index.ts:545-587` | `/logs`: full-file read + JSON.parse per baris setiap 2 detik, O(entire file) per poll | Baca dari EOF (blok terakhir) atau ring buffer |
| B-P1-5 | 🟠 P1 | `xclips-db.ts:311-379` | wordsJson di-parse ulang per request; auto-save triple-write ~1.5 MB/tick | Response tanpa words + single write + tanpa refetch |
| B-P1-6 | 🟠 P1 | `server/index.ts:452,499,731,795` | 4x duplikasi range-parsing + `statSync` blocking per range request + `as any` cast | Extract `serveFileWithRange()` helper tunggal, stat async |
| B-P1-7 | 🟠 P1 | `server/index.ts:386-391` | open-in-explorer: `exec` string-interpolasi path → command injection dari nama file | `execFile` dengan array args |
| B-P1-8 | 🟠 P1 | `server/index.ts:616-727` | GET assets men-trigger network fetch (ytimg) + disk write; fetch tanpa AbortSignal | Pindah auto-fetch ke ingest; wajib `AbortSignal.timeout` |
| B-P1-9 | 🟠 P1 | `queue.ts:195-214` | `saveJob` upsert SQL per ffmpeg stderr tick — puluhan write/detik saat render | Throttle (delta >= 5% atau per 2s) + flush on complete |
| B-P1-10 | 🟠 P1 | `server/index.ts:184-235,309-343` | activeDownloads: floating promise, tanpa GC, tanpa dedupe (double-click = 2 yt-dlp race) | GC berkala + dedupe per URL + `.catch` eksplisit |
| B-P2-11 | 🟡 P2 | `xclips-db.ts:381-414` | `saveTranscript` di luar transaction — race isActive dengan `setActiveTranscript` | Bungkus dalam `this.db.transaction` |
| B-P2-12 | 🟡 P2 | `xclips-db.ts:225-233` | `getAllProjects` parse rawJson semua project per list request | SELECT kolom ringan atau in-memory cache |
| B-P2-13 | 🟡 P2 | `server/index.ts:638,803-820,922-930` | Logika auto-fetch thumbnail YouTube diduplikasi 3 tempat | Extract `ensureThumbnail(projectId)` |
| B-P2-14 | 🟡 P2 | `logger.ts:38` | File app.log level debug default, unbounded, tanpa rotation | Level info untuk file + rotation sederhana |
| B-P2-15 | 🟡 P2 | `server/index.ts:259-287` | `getYouTubeMetadata` dipakai untuk TikTok/IG — naming + komentar menyesatkan | Rename `fetchVideoInfo` saat refaktor berikutnya |
| B-P2-16 | 🟡 P2 | `server/index.ts:705` | `srt.lineCount` salah hitung (jumlah blok, bukan baris) | Hitung `split("\n").length` atau rename label |

---

## Detail P0 — Critical

### B-P0-1. PUT `/api/xclips/clips/:id` TIDAK ADA di server — save clip gagal SILENT 🔴

Store `useStudioStore.ts:632` (`handleSaveClip`) memanggil `PUT /api/xclips/clips/${id}`. Server HANYA punya: `POST /api/xclips/clips` (L1130), `DELETE .../clips/:id` (L1144), `POST .../clips/:id/render` (L1150). Tidak ada PUT handler → Hono return 404 → `apiFetch` return `ok:false` — dan `handleSaveClip` **mengabaikan result** (`await apiFetch(...)` tanpa pengecekan).

Dampak nyata di fitur subtitle & framing: `setStudioAspectRatio`, `setStudioLayoutMode`, `setStudioPanOffsetX`, `setStudioSubtitleStyle` (slider fontSize/outline/positionY di TabFramingStyle, preset picker), `updateSubtitleStyle` — SEMUA memanggil `handleSaveClip` → 100% PUT gagal → **subtitleStyle, layoutMode, panOffsetX, aspectRatio TIDAK PERNAH tersimpan ke DB**. Semua styling subtitle yang user atur hilang saat refresh/switch project. Ini menjelaskan bug UX: "kenapa preset hormozi kembali ke plain setelah reload".

Fix: tambahkan `app.put("/api/xclips/clips/:id", ...)` yang validasi body (Zod, `XclipsClip` shape) + `xclipsDb.saveClip`. Plus `handleSaveClip` di store harus cek `res.ok` dan surface error (silent failure adalah anti-pattern Result-pattern CODING_PREF). Ini temuan paling ACTIONABLE seluruh audit 3 sesi — dampak langsung terasa user, fix < 1 jam.

### B-P0-2. `GET /api/xclips/settings/models` 404 — model list transcribe/highlight tidak pernah ter-load 🔴

Store `useStudioStore.ts:583` memanggil `GET /api/xclips/settings/models?provider=...&apiKey=...`. Route TIDAK ADA di server (yang ada hanya `POST /api/xclips/ai/models` L1005). `fetchAvailableModels` → 404 → catch → `availableHighlightModels: []` → `GenerateSubtitleModal` jatuh ke hardcoded fallback list `["gemini-3-7-flash", "gpt-5-6-terra", "whisper-1"]` (modal L212-214). Model list tidak pernah live; API key dikirim via query param padahal endpoint tak pernah ada (juga melanggar hygiene: key di query string bisa ter-log).

Fix: ganti store ke `POST /api/xclips/ai/models` (sudah ada, body-based, key tidak ke query string) — sekaligus menutup temuan P1-11 dari laporan fitur subtitle.

### B-P0-3. CORS reflect-any-origin + credentials + listen 0.0.0.0 🔴

`src/server/index.ts:18-27`: `origin: (origin) => origin || "*"` + `credentials: true`, dan server listen `0.0.0.0:3351` (terverifikasi netstat saat audit: kedua port 3350/3351 LISTENING di semua interface). Kombinasi reflect-origin + credentials pada interface yang reachable dari LAN/Tailscale = browser tab malicious di jaringan yang sama bisa memanggil API (transcribe, delete, render, open-in-explorer, download dari URL arbitrer) dengan cookie session. Hono cors origin-callback seperti ini memantulkan SEMUA origin.

Fix: whitelist origin `http://localhost:3350`, `http://127.0.0.1:3350`, Tailscale host; atau turunkan `credentials` (API ini tidak pakai cookie auth sama sekali — `credentials: "include"` di apiFetch juga tidak perlu). Ini local-first tool, bukan multi-user — hardening murah.

---

## Detail P1 — Performance Hot Path

### B-P1-4. `/logs` endpoint: full-file read + JSON.parse per baris, SETIAP 2 DETIK 🟠

`server/index.ts:545-587`: `fs.readFileSync(logs/app.log)` seluruh file (saat audit: 179 KB dan tumbuh — tiap request API juga nulis log) → split per baris → iterate dari belakang, JSON.parse per baris, filter projectId, sampai 150 entries. TabLogs poll setiap 2000 ms (TabLogs.tsx:353). Untuk sesi panjang + banyak render, file log bisa MB → full read + ratusan parse per 2 detik per client yang membuka tab Logs.

Ironisnya: middleware logging sengaja skip `/logs` (L40) supaya polling tidak menumbuhkan log — tapi semua API call LAIN tetap menulis, jadi file tumbuh terus dan scan makin mahal. Desain logging + polling-nya saling membebani.

Fix (bertahap, tanpa rombak besar):
1. Short-term: baca dari EOF — `fs.open` + `stat` ukuran, baca hanya blok terakhir (mis. 256 KB) dengan `readSync` offset, parse dari belakang. O(ukuran tetap), bukan O(file).
2. Better: pino destination rotation (pino.roll atau cron) ATAU in-memory ring buffer: logger menulis juga ke `logRingBuffer` (array max 2000 entries) → `/logs` cukup filter buffer, nol disk read.
3. `DELETE /logs` menulis `""` via writeFileSync — cukup truncate via `fs.truncateSync`.

### B-P1-5. Transkrip JSON dibongkar+disimpan ulang berkali-kali (hot path auto-save) 🟠

`xclips-db.ts:311-379`: `getProjectTranscripts` / `getTranscript` melakukan `JSON.parse(row.wordsJson)` untuk setiap row. Kata 30-menit video ≈ 4.000-6.000 kata × ~90 byte JSON = ~500 KB per track. Tiga konsumen paralel:
- auto-save subtitle (tiap idle 1s saat editing) → `saveTranscriptWords` → full rewrite
- `fetchSubtitleTracks` refetch SEMUA track → parse SEMUA wordsJson semua track (lihat P1-9 laporan fitur)
- action lain (switch track, transcribe, download) memicu `fetchAssets` yang juga `getTranscript` → parse lagi
Plus `rawText` + `srtContent` disimpan ulang di setiap save (redundansi diperkuat: triple write ~1.5 MB per auto-save tick).

Fix: (1) jangan sertakan `words` di response `GET /subtitles` (metadata saja: id, label, count, dates) — client hanya perlu words saat `switch`; (2) pertimbangkan simpan wordsJson sebagai file per track (`vault/xclips/cache/{projectId}/transcripts/{trackId}.json`) dan DB hanya metadata — SQLite tidak ideal sebagai blob store untuk payload 0.5 MB yang di-parse per request; (3) auto-save cukup patch track bersangkutan tanpa refetch storm.

### B-P1-6. Streaming video: mekanisme benar, tapi sync I/O + duplikasi route 4x 🟠

Empat route streaming (media/stream L452, clips/stream L499, media/audio L731, thumbnail L795) menyalin blok range-parsing identik dengan `fs.statSync` (blocking event loop di setiap range request — video player mengirim banyak range request saat seek). Fallback `fs.createReadStream(...) as any` — zero-any violation dan cast tidak aman (Node stream bukan web ReadableStream; hanya selamat karena runtime Bun).

Fix: extract `serveFileWithRange(c, filePath, mime)` helper tunggal + `stat` async (`Bun.file(path).stat()`), hapus branch Node yang mati (project ini Bun-only). Duplikasi 4x → 1 util.

### B-P1-7. open-in-explorer: exec string-interpolasi path — command injection 🟠

`server/index.ts:386-391`: `explorer.exe /select,"${absolutePath}"` di-`exec` langsung. Path berasal dari body request (`path` atau `sourcePath` project). Di Windows, path berisi `&` atau metacharacter shell → command execution. Lokal tool risikonya terbatas, tapi path dari URL ingest (YouTube title masuk ke nama file!) mengalir ke sini — nama file dengan karakter shell legal di Windows = eksploit nyata.

Fix: gunakan `execFile("explorer.exe", ["/select,", absolutePath])` (array args, tanpa shell). Sama untuk `open -R` di macOS.

### B-P1-8. Assets endpoint men-trigger network fetch + disk write di GET request 🟠

`server/index.ts:616-727` (`GET .../assets`): jika thumbnail belum ada dan project YouTube → `fetch i.ytimg.com` + tulis disk (L638-652). GET yang menulis disk + menunggu network = latency spike + surprise side effect; dipanggil berulang oleh aftermath auto-save/switch. `fetch` tanpa `AbortSignal.timeout` juga melanggar backend standards.

Fix: pindah auto-fetch thumbnail ke saat ingest (sekali, di service layer), assets route hanya baca. Semua `fetch` wajib `AbortSignal.timeout(10_000)`.

### B-P1-9. Render queue progress: `saveJob` per ffmpeg stderr tick 🟠

`queue.ts:195-214`: setiap progress tick ffmpeg (banyak per detik) → `xclipsDb.saveJob(job)` (upsert SQL). Dengan 2 job concurrent, itu puluhan upsert/detik ke SQLite WAL. Tidak fatal (SQLite cepat), tapi write amplification sia-sia + WAL checkpoint pressure.

Fix: throttle saveJob (mis. hanya jika `pct - lastSaved >= 5` atau tiap 2s), simpan progress in-memory di job manager, flush saat completed/failed.

### B-P1-10. Background download: floating promise, no task GC, no dedupe 🟠

`server/index.ts:184-235, 309-343`: `(async () => {...})()` tanpa `.catch` di luar try-catch dalam. `activeDownloads` Map TIDAK PERNAH dibersihkan setelah completed/error (memory leak per sesi panjang). Tidak ada dedupe: double-click "download" = dua task yt-dlp men-download file sama bersamaan (race write file sama, dua progress entry).

Fix: `setInterval` GC entries completed >10 menit; dedupe per (url) aktif; `.catch` eksplisit. Catatan: task state in-memory deviasi dari prinsip "Stateless: no in-memory state" — acceptable untuk local tool, tapi progress hilang saat restart (dokumentasikan).

---

## Detail P2 — Hygiene

- **B-P2-11 saveTranscript race**: `saveTranscript` (db:381-414) melakukan UPDATE isActive=0 + upsert di LUAR transaction, sementara `setActiveTranscript` pakai transaction. Auto-save + switch track cepat bisa interleave → track lama tertulis `isActive: 1`. Fix: bungkus dalam `this.db.transaction`.
- **B-P2-12 getAllProjects**: parse rawJson semua project per list request. Fix: SELECT kolom ringan (id, name, duration, createdAt) atau in-memory cache. Low priority.
- **B-P2-13 duplikasi thumbnail logic**: auto-fetch thumbnail YouTube diulang di assets (L638), thumbnail route (L803-820), download route pakai path berbeda. Extract `ensureThumbnail(projectId)`.
- **B-P2-14 log unbounded**: file app.log level `debug` default, tanpa rotation (179 KB / ~1 hari). Tambah rotation atau level `info`; konsumen utama `/logs` — lihat B-P1-4.
- **B-P2-15 naming salah kaprah**: `getYouTubeMetadata` dipakai untuk TikTok/IG via `--dump-json` — berfungsi tapi komentar & penamaan menyesatkan. Rename `fetchVideoInfo` saat refaktor.
- **B-P2-16 srt.lineCount**: dihitung `split("\n\n").length` = jumlah blok, bukan baris. Ganti hitungan atau rename label "blockCount".

---

## Yang Sudah Baik (dipertahankan)

- **WAL + busy_timeout 5000 + synchronous NORMAL + FK ON** — pragmas SQLite tepat untuk workload ini.
- **Prepared statements + parameter binding** di seluruh hot path DB — tidak ada SQL injection dari parameter.
- **`Bun.file().slice()` untuk range streaming** — zero-copy, pilihan tepat (masalahnya hanya statSync + duplikasi, bukan mekanismenya).
- **Migration runtime idempotent** (`ensureColumns`, legacy UNIQUE migration) — pattern bagus tanpa framework.
- **Tracing middleware + X-Trace-Id + status-code-aware logging** — observability standar terpenuhi.
- **Render queue concurrency 2 + hwaccel detection cached** — keputusan tepat; maxConcurrent=2 aman untuk CPU encoder.
- **AbortSignal.timeout di semua AI dispatch** — sesuai backend standards.
- **Result pattern konsisten** di service layer (`{success, data|error}`).
- **`saveClipsBatch` pakai transaction** — pattern benar untuk bulk insert (cukup diterapkan juga ke saveTranscript, lihat B-P2-11).

---

## Rekomendasi Prioritas

**Sprint 1 — cepat, dampak besar (±3 jam):**
1. B-P0-1: tambah PUT `/api/xclips/clips/:id` + cek `res.ok` di `handleSaveClip` (TANPA ini semua persist styling subtitle mati)
2. B-P0-2: store ganti ke `POST /api/xclips/ai/models` (menutup 404 + query-string key sekaligus)
3. B-P0-3: CORS whitelist localhost + Tailscale, drop `credentials`
4. B-P1-7: `execFile` untuk open-in-explorer

**Sprint 2 — hot path (±0.5 hari):**
5. B-P1-4: `/logs` baca dari EOF / ring buffer + rotation pino
6. B-P1-5: response `GET /subtitles` tanpa words + auto-save tanpa refetch storm
7. B-P1-9: throttle saveJob progress

**Sprint 3 — hygiene (±0.5 hari):**
8. B-P1-6: helper `serveFileWithRange` tunggal + stat async
9. B-P1-8: pindah thumbnail auto-fetch ke ingest + AbortSignal di semua fetch
10. B-P1-10: GC + dedupe activeDownloads
11. B-P2-11: transaction saveTranscript; B-P2-16 lineCount; B-P2-14 log level

---

## Summary

- Total findings: **16** (3 P0, 7 P1, 6 P2)
- P0 (critical): PUT clips 404 silent (styling tidak persist), models route 404 (fitur mati + key di query string), CORS + 0.0.0.0
- P1 (high): seluruh hot path — /logs O(file) per 2 detik, triple-write transkrip per tick, statSync per range request, command injection, GET dengan side effect, saveJob per tick, download tanpa GC/dedupe
- P2 (medium): transaction race, rawJson list view, duplikasi thumbnail, log unbounded, naming, lineCount

Kumulatif 3 sesi audit (fitur subtitle Part 1+2 + backend Part 3): **53 findings (7 P0, 21 P1, 25 P2)**.

Catatan perencanaan fix: B-P0-1 adalah temuan paling ACTIONABLE seluruh audit — dampak langsung terasa user (styling subtitle tidak persist) dan fixnya satu route + satu pengecekan result. P0-1 dari laporan fitur subtitle (ASS drift saat filler removal) tetap yang paling strategis untuk kualitas output render.
