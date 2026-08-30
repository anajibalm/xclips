# Audit: Subtitle, Transkrip & Sinkronisasi (Tab Subtitles)

**Date**: 2026-08-29
**Scope**: Fitur subtitle/transkrip/sinkronisasi pada tab Subtitles — end-to-end (UI → store → API → DB → render pipeline)
**Status**: DONE (audit read-only, tanpa perubahan kode)

**Files audited**:
- `src/app/xclips/studio/tabs/TabSubtitles.tsx` (749 LOC)
- `src/app/xclips/studio/hooks/useTranscriptVirtualizer.tsx` (226 LOC)
- `src/app/xclips/studio/hooks/useVideoPlaybackSync.ts` (204 LOC)
- `src/app/xclips/studio/store/useStudioStore.ts` (1124 LOC)
- `src/app/xclips/studio/modals/GenerateSubtitleModal.tsx` (408 LOC)
- `src/app/xclips/studio/components/StudioCanvas.tsx` (subtitle overlay)
- `src/lib/xclips.service.ts` (transcribeProject, fetchYouTubeSubtitles, saveTranscriptWords, updateTranscriptWords, dispatchAiContent)
- `src/lib/xclips/ytdlp-downloader.ts` (parseSrtToWords)
- `src/lib/xclips/ffmpeg-builder.ts` (generateAssSubtitles)
- `src/lib/xclips/queue.ts` (render pipeline)
- `src/lib/xclips/filler-detector.ts`
- `src/lib/xclips/types.ts` / `xclips-db.ts`
- `src/server/index.ts` (subtitle & transcript routes)

---

## Findings Summary

| # | Severity | Lokasi | Issue |
|---|----------|--------|-------|
| 1 | 🔴 P0 | `queue.ts:126-144` + `ffmpeg-builder.ts:62-95,280-281` | **ASS subtitle timing drift saat filler/silence removal** — subtitle burn-in pakai timeline asli, video dipotong keep-intervals → drift progresif |
| 2 | 🔴 P0 | `server/index.ts:982` vs `:1121` | **Duplicate PUT route** `/api/xclips/projects/:id/transcript` — route kedua (saveTranscriptWords + transcriptId) dead code, transcriptId selalu diabaikan |
| 3 | 🔴 P0 | `server/index.ts:986,1124`, `xclips.service.ts:872` | **Input `words: any[]` tanpa Zod validation** + JSON.parse output LLM tanpa schema (AI output tanpa schema parsing = red flag) |
| 4 | 🔴 P0 | `xclips.service.ts:990-995` | **fetchYouTubeSubtitles ambil file `.srt` PERTAMA di folder** — folder shared multi-video → salah track subtitle video lain |
| 5 | 🟠 P1 | 4 lokasi | **Phrase segmentation 4 implementasi dengan aturan BERBEDA** — preview UI ≠ SRT export ≠ ASS render (WYSIWYG violation) |
| 6 | 🟠 P1 | `ffmpeg-builder.ts:225-227` | `generateAssSubtitles` **tidak skip `excluded` words** — kata yang di-exclude user tetap muncul di render (SRT generator sudah skip) |
| 7 | 🟠 P1 | `useTranscriptVirtualizer.tsx:168-179` | **Drag-reorder phrase merusak kronologi** — urutan array berubah, timestamp tidak → SRT/active-detection kacau |
| 8 | 🟠 P1 | `useTranscriptVirtualizer.tsx:136-165` | **Edit teks frase → uniform redistribution** semua timestamp kata — timing akurat kata yang tidak diedit ikut hilang, tanpa undo |
| 9 | 🟠 P1 | `useStudioStore.ts:738-748` | **Auto-save sukses → fetchSubtitleTracks + fetchAssets + fetchLogs full refetch** setiap 1s idle editing — network/CPU boros (words JSON semua track) |
| 10 | 🟠 P1 | `xclips.service.ts:887-933` | **Multi-chunk transcribe sequential + silent skip** — chunk gagal hilang tanpa warning; boundary 300s tanpa overlap → kata terpotong/duplikat di batas chunk |
| 11 | 🟠 P1 | `xclips.service.ts:670` + `useStudioStore.ts:577` | **API key via query string** (`?key=...` Gemini, `apiKey` param models) → ter-log di proxy/server history |
| 12 | 🟠 P1 | `useTranscriptVirtualizer.tsx:88` | **Viewport virtualizer hardcoded 800px** — container lebih tinggi → frase hilang saat scroll cepat |
| 13 | 🟠 P1 | `useTranscriptVirtualizer.tsx:100-107` + `StudioCanvas.tsx:70-119` | **Active-phrase O(n) linear search per playback tick di DUA konsumen independen** + segmentation diduplikasi di Canvas |
| 14 | 🟠 P1 | `useStudioStore.ts:870-926` | **SRT download & ASS render TIDAK menerapkan subtitleOffsetMs** — offset hanya live di preview; export sebelum "Apply Permanently" menghasilkan timing tanpa offset |
| 15 | 🟡 P2 | `useTranscriptVirtualizer.tsx:17-53` dll. | Magic numbers duplikat: gap 0.8s, maxWords 6, hang 0.35s, formula offset 3x |
| 16 | 🟡 P2 | `TabSubtitles.tsx:486-488` + virtualizer L182-185 | Search tanpa debounce; `new RegExp` + `toLowerCase().includes()` dibangun ulang per item per render |
| 17 | 🟡 P2 | `TabSubtitles.tsx:527` | Scroll handler `setScrollTop` per scroll event tanpa throttle/rAF → re-render penuh ~60x/detik |
| 18 | 🟡 P2 | `useTranscriptVirtualizer.tsx:100-102` | `currentWord` dead computation (tidak dikonsumsi) — O(n) scan per tick sia-sia |
| 19 | 🟡 P2 | `studio.types.ts:170-171` + store | `expandedPhraseId`/`ITEM_EXPANDED_HEIGHT` dead — tidak pernah di-set dari UI; positions bisa disederhanakan jadi aritmetika O(1) |
| 20 | 🟡 P2 | `xclips-db.ts:388-413` | Redundansi data 3x per track: `wordsJson` + `rawText` + `srtContent` (derived data disimpan) |
| 21 | 🟡 P2 | `useStudioStore.ts:842-868` + `selectedSubtitleSource` | Dead/candidates: `handleSaveTranscript` tak terlihat dipakai UI, `selectedSubtitleSource` redundant dengan subtitleTracks |
| 22 | 🟡 P2 | `GenerateSubtitleModal.tsx:57-69` | Label auto-increment `Track-N` bisa collision dengan custom label existing |
| 23 | 🟡 P2 | `TabSubtitles.tsx:284` + store L928 | `parseInt` membuang desimal input offset; tidak ada clamp range; sign convention offset tidak didokumentasikan di UI |
| 24 | 🟡 P2 | `ytdlp-downloader.ts:844-890` | `parseSrtToWords` tidak dedup token roll-up YouTube auto-CC (block overlap → kata berulang); `.vtt` dicari di downloadsDir tapi hanya `.srt` di cacheDir (inkonsisten) |
| 25 | 🟡 P2 | `TabSubtitles.tsx:75-77`, `GenerateSubtitleModal.tsx:71-73` | `isYouTubeProject` regex duplikat 2x |
| 26 | 🟡 P2 | `filler-detector.ts:32-104` + virtualizer L151 | Setelah edit manual frase, kata baru tidak re-run filler detection (`isFiller: false` hardcoded) → removeFillers render tak memotong |

---

## Detail P0 — Critical

### P0-1. ASS subtitle drift saat filler removal (BUG SYNC inti fitur)

`queue.ts:159-163` menghitung `keepIntervals` (filler/customCuts dipotong dari video), lalu `buildFfmpegCommand` (`ffmpeg-builder.ts:62-95`) melakukan `trim + setpts=PTS-STARTPTS + concat` → **timeline video hasil render BERBEDA dari timeline source**. Namun `generateAssSubtitles` (`ffmpeg-builder.ts:280-281`) menghitung `phraseStart = word.start - clipStartSec` memakai **timeline asli**. Konsekuensi: setelah setiap filler yang dihapus, semua subtitle berikutnya muncul terlalu cepat (drift = total durasi cut sebelum titik kata). Ini kemungkinan besar alasan user butuh tombol offset manual ±1000ms — offset adalah workaround untuk bug ini.

**Remediation**: remap timestamp subtitle terhadap keep-intervals sebelum menulis ASS — untuk tiap kata, kurangi `sum(interval terhapus sebelum kata)`. Simpan remap sebagai fungsi murni `remapWordsToKeepTimeline(words, keepIntervals)` + unit test boundary (kata tepat di boundary cut, kata span cut penuh, cut pertama/terakhir).

### P0-2. Duplicate PUT route → transcriptId dead code

`server/index.ts:982` (`updateTranscriptWords`, abaikan `transcriptId`) dan `:1121` (`saveTranscriptWords`, support `transcriptId`) mendaftar PUT path identik. Hono memenangkan handler pertama → route kedua unreachable. Auto-save (`useStudioStore.ts:731-734`) mengirim `transcriptId` yang **selalu diabaikan** — semua edit ditulis ke track AKTIF. Race: user switch track saat auto-save in-flight → edit bisa masuk track yang salah.

**Remediation**: hapus salah satu route (rekomendasi: keep `saveTranscriptWords` + `transcriptId`, hapus route pertama), satu handler, validasi 400 jika `transcriptId` tidak ditemukan.

### P0-3. Input & LLM output tanpa Zod (red flag CODING_PREF)

- `server/index.ts:986` `body?.words` dan `:1124` `words?: any[]` — zero-any violation, tidak divalidasi `WordTimestampSchema` yang sudah ada di `types.ts:7-16`.
- `xclips.service.ts:872` `JSON.parse(cleanJsonStr)` hasil LLM tanpa schema — kata `start/end` bisa string/null → `parseFloat(w.start.toString())` defensive tapi `parsedData.words` non-array akan `TypeError` (`.map` on undefined guarded dengan `|| []`, tapi item non-object crash `.word`).
- `XclipsTranscript`/`XclipsClip` interface-only; `JSON.parse(row.wordsJson)` dari DB tidak divalidasi.

**Remediation**: `z.array(WordTimestampSchema).min(1)` di route PUT; `TranscriptionResultSchema` untuk parse output LLM (safeParse → error message jelas "model mengembalikan format tidak valid"); parse DB row dengan schema versi-toleran.

### P0-4. fetchYouTubeSubtitles salah ambil file SRT

`xclips.service.ts:990-995`: `files.find((f) => f.endsWith(".srt") || f.endsWith(".vtt"))` pada `path.dirname(project.sourcePath)` — folder downloads yang sama untuk SEMUA project. Jika ada ≥2 video dengan subtitle, project A bisa memuat subtitle video B (data corruption + timing nyasar total).

**Remediation**: match nama file terhadap `project.sourcePath` basename atau video ID (`[a-zA-Z0-9_-]{11}`), bukan `.find()` pertama. Fallback ke cacheDir hasil yt-dlp (yang sudah project-scoped).

---

## Detail P1 — High (best-practice violations & perf)

### P1-5. Empat implementasi phrase segmentation dengan aturan berbeda (WYSIWYG violation)

| Lokasi | Break rules |
|---|---|
| `useTranscriptVirtualizer.tsx:28-33` (UI preview) | `/[.?!,;:]$/` \|\| maxWords 6 \|\| gap 0.8s |
| `StudioCanvas.tsx:82-87` (canvas preview) | identik virtualizer (copy-paste) |
| `xclips.service.ts:50` (generateSrtFromWords: SRT export + DB) | maxWords 6 \|\| `/[.?!]$/` (tanpa `,:`, tanpa gap) |
| `ffmpeg-builder.ts:263-268` (ASS render) | maxWords 6 (plain) / 4 (preset lain) \|\| `[.?!]` |
| `useStudioStore.ts:885` (handleDownloadSrt client-side) | maxWords 6 \|\| `/[.?!]$/` |

Frase yang dipech pada koma/titik-dua di editor TIDAK dipech di SRT/ASS hasil render. Karaoke preview 6 kata, render preset non-plain hanya 4. Untuk fitur "subtitle accuracy" (preference eksplisit user), ini defect nyata.

**Remediation**: ekstrak SATU modul `src/lib/xclips/phrase-segmentation.ts` — `segmentPhrases(words, options: { maxWords, gapSec, breakChars })`. Semua konsumen (virtualizer, canvas, SRT, ASS, download) import modul yang sama; opsi style ASS hanya override `maxWords`. Unit test: kata dengan `,` di akhir, gap 0.79 vs 0.81s, maxWords exact 6/7, kata terakhir tanpa punctuation.

### P1-6. ASS tidak skip excluded words

`ffmpeg-builder.ts:225-227` filter hanya clip bounds — `w.excluded` bocor ke render. `generateSrtFromWords:48` sudah `if (w.excluded) continue`. Inkonsistensi editor↔render.

**Remediation**: tambah `&& !w.excluded` pada filter clipWords (dan sinkron dengan P1-8 untuk re-timing).

### P1-7. Drag-reorder phrase merusak kronologi

`useTranscriptVirtualizer.tsx:168-179`: reorder menyusun array words tapi timestamp tidak diubah → SRT tidak monoton, `phraseSegments.find(t)` active-detection salah, karaoke canvas salah frase.

**Remediation** (pilih): (a) hapus fitur reorder — subtitle timestamped tidak punya semantik reorder; (b) ubah jadi "move view order" tanpa menyentuh `editableWords`; (c) jika memang disengaja untuk rearrange narasi, wajib re-timing seluruh frases berikutnya (kompleks). Rekomendasi: (a) + tombol merge frase adjacent sebagai gantinya.

### P1-8. Uniform redistribution saat edit frase

`handleUpdatePhraseText:143-153`: seluruh kata dalam frase di-redistribute merata walaupun user hanya koreksi typo 1 kata. Timing asli (presisi karaoke) hilang untuk semua kata di frase tsb.

**Remediation**: token-match alignment sederhana — untuk kata yang identik (case-insensitive) di posisi berdekatan, pertahankan `start/end` asli; distribute hanya token baru/sisanya. Plus dukung undo (simpan snapshot frase sebelum edit di store).

### P1-9. Auto-save → full refetch storm

`handleAutoSaveTranscript:738-748`: tiap auto-save sukses memicu `fetchSubtitleTracks(id)` (response berisi **words array SEMUA track** — MB-scale JSON per track), plus `fetchAssets` + `fetchLogs`. Saat editing intensif ini loop tiap ~1-2 detik. Boros network + parse + re-render list.

**Remediation**: response PUT sudah berisi transcript ter-update — set `subtitleTracks` secara lokal (patch item by id), TIDAK perlu fetch. Reservasi full refresh hanya untuk create/switch/delete track.

### P1-10. Multi-chunk transcribe: lambat, silent-skip, boundary tanpa overlap

`xclips.service.ts:887-933`:
1. Sequential `await` per chunk — video 60 menit = 12 chunk × 30-60s ≈ 6-12 menit total.
2. `if (dispatchRes.success) {...}` tanpa `else` — chunk gagal hilang diam-diam (lubang transkrip, user tidak diberi tahu).
3. Boundary 300s exact tanpa overlap — kata yang menyeberangi boundary terpotong jadi 2 transkripsi parsial → duplikasi/potongan aneh.
4. `extractAudioSegment(videoPath, ...)` re-extract dari SOURCE per chunk — decode ulang video penuh 12x.

**Remediation**: (1) concurrency pool 2-3 (Promise.all batches, hormati rate limit); (2) log warn + tandai partial di response + UI badge "transkrip parsial (chunk 4 gagal)"; (3) overlap 3s antar chunk audio + dedupe kata berdasarkan waktu; (4) extract compressed audio SEKALI lalu split file mp3 per chunk (`-ss/-t` pada mp3 cepat).

### P1-11. API key via query string

- Gemini direct: `xclips.service.ts:670` `?key=${apiKey}` → key masuk server/proxy logs. Gunakan header `x-goog-api-key`.
- Client `fetchAvailableModels` (`useStudioStore.ts:577`) kirim `apiKey` via query param → pindah ke POST body.

### P1-12. Viewport virtualizer hardcoded 800px

`useTranscriptVirtualizer.tsx:88`: `positions[end].top < scrollTop + 800`. Di layar tinggi (contoh: 1440p, container ~1100px) item di bawah 800px dari scrollTop TIDAK dirender → gap kosong saat scroll cepat / scrollbar jump.

**Remediation**: ukur `containerHeight` via ref + ResizeObserver, simpan state; fallback 450.

### P1-13. Active phrase O(n) per tick × 2 konsumen

- `currentTime` update ~15fps (rAF loop `useVideoPlaybackSync.ts:118`, threshold 0.06s).
- Virtualizer L100-107: `editableWords.find()` + `phraseSegments.find()` = 2 full scan per tick.
- `StudioCanvas.tsx:70-119`: segmentation + find DIDUPILIKASI sendiri (page.tsx tidak mengirim `currentActivePhrase`) → dua kali kerja sama per tick.

**Remediation**: (a) hitung sekali — page mengirim hasil virtualizer (atau derived selector store) ke Canvas via props yang sudah disediakan (`externalActivePhrase`/`externalEffectiveSubtitleTime` sudah ada di props Canvas, tinggal dipakai); (b) ganti linear find dengan binary search (`phraseSegments` sorted by `startSec`) atau moving-pointer index.

### P1-14. Offset tidak diterapkan pada SRT export & ASS render

`subtitleOffsetMs` hanya hidup di preview (virtualizer + canvas). `handleDownloadSrt:879-900` dan `generateAssSubtitles` pakai words mentah. User kalibrasi offset → export SRT tanpa offset → timing salah di file hasil. "Apply Permanently" adalah satu-satunya jalan dan sifatnya destruktif (rewrite seluruh timestamp, tak bisa dibatalkan).

**Remediation**: opsi A (rekomendasi): SRT export menerapkan offset secara live saat generate (`w.start - offset`), plus toggle "include current offset" default ON. Opsi B: simpan `subtitleOffsetMs` per track di DB (`transcripts.subtitleOffsetMs`) dan terapkan di render ASS — reversible, tidak rewrite words. Opsi B lebih best-practice (non-destructive).

---

## Detail P2 — Medium (cleanup & polish)

- **P2-15 Magic numbers**: buat `src/lib/xclips/subtitle-constants.ts` — `PHRASE_MAX_WORDS=6`, `PHRASE_GAP_SEC=0.8`, `PHRASE_HANG_TOLERANCE_SEC=0.35`, `DEFAULT_TRANSCRIBE_MODEL`. Formula `currentTime - offsetMs/1000` (3x: virtualizer L97/L111, canvas L112) → util `getEffectiveSubtitleTime(currentTime, offsetMs)`.
- **P2-16 Search**: debounce `searchQuery` 200ms di store setter (atau `useDeferredValue`); build regex sekali per query via `useMemo`, bukan per item (`renderHighlightedText:184`).
- **P2-17 Scroll**: throttle `setScrollTop` via rAF (`onScroll` handler → `requestAnimationFrame` coalesce), atau simpan di ref + hanya setState saat `visibleRange` berubah.
- **P2-18 `currentWord` dead**: hapus dari virtualizer return (tidak dikonsumsi).
- **P2-19 `expandedPhraseId` dead**: tidak pernah di-set dari UI → hapus `ITEM_EXPANDED_HEIGHT` + variable-height positions; ganti `positions[]` dengan aritmetika langsung `top = index * (BASE + GAP)` (O(1), hemat alokasi array per recompute).
- **P2-20 DB redundansi**: `rawText` + `srtContent` derived dari `wordsJson` — simpan hanya `wordsJson`, generate SRT on-demand (route `GET .../subtitles/:trackId/download` sudah generate dari DB). Hemat disk (cost-sensitive).
- **P2-21 Dead code**: verify & hapus `handleSaveTranscript` (tak terlihat dipakai Tab), `selectedSubtitleSource` (redundant), duplicate route (P0-2), `saveTranscriptWords` vs `updateTranscriptWords` duplikat semantik di service.
- **P2-22 Track-N collision**: `maxNum` harus mulai dari 0 dan scan SEMUA label numerik; atau `Track-${maxExisting+1}` dengan fallback timestamp.
- **P2-23 Offset input**: `parseInt` → `Math.round(parseFloat)`; clamp ±10_000ms; tambahkan hint UI "offset positif = subtitle dimajukan".
- **P2-24 parseSrtToWords**: (a) dedup block roll-up YT auto-CC (block n berisi teks block n-1 + tambahan — deteksi prefix overlap); (b) samakan `.vtt`/`.srt` di downloadsDir vs cacheDir; (c) konstanta `confidence` jujur (0.9 untuk auto-CC).
- **P2-25 isYouTubeProject**: extract helper `isYouTubeSource(project)` di types/studio.utils.
- **P2-26 Filler re-detect**: setelah `handleUpdatePhraseText`, jalankan `detectTokenFillers` untuk kata frase tsb (sudah ada dependency `@/lib/xclips/filler-detector` di client? — filler-detector pure & importable, tinggal panggil pada newWordsForPhrase).

---

## Quick Wins (≤1 jam masing-masing, urut dampak)

1. Fix P0-2 (hapus duplicate route) — 15 menit, hilangkan risiko data masuk track salah.
2. Fix P1-6 (ASS skip excluded) — 5 menit, 1 baris filter.
3. Fix P0-4 (SRT match by basename/videoId) — 30 menit.
4. Zod validation PUT words (P0-3 sebagian) — 30 menit.
5. Auto-save tanpa full refetch (P1-9) — 30 menit, hemat bandwidth besar.
6. Viewport virtualizer dari ResizeObserver (P1-12) — 45 menit.
7. Hapus dead computation `currentWord` + reorder-feature decision (P1-7) — 30 menit.

## Strategic (butuh desain + test)

1. **P0-1 subtitle remap saat filler removal** — fungsi `remapWordsToKeepTimeline` + unit test; menghapus root cause kebutuhan offset manual.
2. **P1-5 single segmentation module** + migrasi 5 call-site; unit test boundary.
3. **P1-10 transcribe concurrent + overlap + partial-flag** + progress per chunk ke UI (saat ini hanya spinner).
4. **P1-14 offset per-track di DB** (non-destructive calibration).

## Yang Sudah Baik (dipertahankan)

- `dispatchAiContent` memakai `AbortSignal.timeout()` sesuai backend standards; Result pattern konsisten di service.
- Virtualized list dengan overscan + absolute positioning — arsitektur tepat untuk ribuan frase.
- Escape regex di `renderHighlightedText` (aman injection); XSS-safe rendering.
- Debounce auto-save 1s dengan timeout reset — pattern benar (masalahnya hanya aftermath refetch-nya).
- Multi-track subtitle dengan switch/delete + active flag di DB — model data tepat.
- Store setter `setEditableWords` hanya memicu autosave untuk perubahan user (switch track pakai `set()` langsung) — disiplin yang benar.
- Compressed 48k MP3 untuk transkripsi — keputusan hemat bandwidth yang tepat.

## Summary

- Total findings: 26
- P0 (critical): 4 — sync drift render, duplicate route, tanpa validasi, salah-ambil SRT
- P1 (high): 10 — WYSIWYG segmentation split, excluded leak, reorder rusak, redistribution, refetch storm, transcribe sequential/silent-skip, key di URL, viewport hardcode, O(n)×2 per tick, offset tidak diekspor
- P2 (medium): 12 — duplikasi konstanta, dead code, debounce, DB redundansi, dsb.

Rekomendasi eksekusi: Quick wins #1-#4 dulu (hapus risiko data), lalu strategic P0-1 (remap subtitle — inti fitur sinkronisasi), baru P1-5 (segmentation unifikasi).

---

# PART 2 — Coverage lanjutan (audit sesi kedua, 2026-08-29 21:30)

**Files audited (Part 2 additions)**:
- `src/app/xclips/studio/components/StudioTimeline.tsx` (352 LOC — scrubber, timecode display, clamp range)
- `src/app/xclips/studio/tabs/TabFramingStyle.tsx` (subtitle style sliders & persist wiring)
- `src/app/xclips/studio/page.tsx` (326 LOC — tab wiring & modal mounting)
- `src/lib/xclips/vfr-probe.ts` (extractCompressedAudio, extractAudioSegment)
- `src/lib/api-client.ts` (52 LOC — apiFetch)
- `docs/PRD-xclips.md` + `FEATURES.md` (spec compliance review)
- `tests/xclips/transcript-chunker.test.ts` + `tests/xclips/xclips-db.test.ts` (test integrity review)
- Re-read pada state terbaru: `src/lib/xclips.service.ts` (1542 LOC), `src/server/index.ts`, `StudioCanvas.tsx`

Catatan: `src/lib/xclips.service.ts` berubah paralel saat audit (1284 → 1542 baris; `transcribeProject` di-rewrite: provider auto-routing, OpenAI Whisper path, `parseTranscriptWords` + regex fallback). Temuan Part 1 di bawah dire-verifikasi terhadap state terbaru.

## Status Re-verification (Part 1 vs state saat ini)

| Finding | Status baru |
|---|---|
| P0-2 duplicate PUT route | **MASIH ADA** — `server/index.ts:983` vs `:1122`, handler pertama menang, `transcriptId` tetap dead |
| P0-3 tanpa Zod | **SEPARUH membaik** — `parseTranscriptWords` (service:811-869) defensive + regex fallback, tapi masih `any` (L823-824) & tanpa schema; route PUT tetap tak divalidasi |
| P0-4 salah ambil .srt | **TETAP** — service:1248-1253 `files.find(f => f.endsWith(".srt") || ".vtt")` di folder shared |
| P1-10 transcribe chunk | **BERUBAH** — chunk kini 900s, single-chunk ≤1800s, ada Whisper path; TAPI masih sequential + silent-skip + tanpa overlap; **RISIKO BARU: timeout single-chunk turun ke 45s** (dulu 180s) — terlalu agresif untuk audio 30 menit (lihat P1-28) |
| P1-14 offset di export/render | **TETAP** — `handleDownloadSrt` & `generateAssSubtitles` pakai words mentah |
| P1-13 segmentation duplikat di Canvas | **TETAP** — StudioCanvas.tsx:70-107 masih copy-paste |

## Findings Baru (Part 2)

| # | Severity | Lokasi | Issue |
|---|----------|--------|-------|
| 27 | 🟠 P1 | `queue.ts:112` | **Render mengabaikan `clip.transcriptId`** — selalu pakai track AKTIF (`getTranscript(job.projectId)`), padahal `discoverHighlights` menyimpan `transcriptId` per clip & schema DB mendukungnya. User switch track → semua render pakai words track baru, bukan track asal clip. Data integrity + kejutan render. |
| 28 | 🟠 P1 | `xclips.service.ts:1140` | **Timeout single-chunk 45s untuk audio ≤30 menit** — PRD KPI 60 detik untuk video 30 menit; audio 30 mnt @48k mono ≈ 17MB base64, Gemini realistis butuh >45s untuk word-level timestamps. Kegagalan transkrip video menengah akan sering. Chunked path (30+ mnt) juga 45s tapi per 15-menit chunk — masih ketat. |
| 29 | 🟠 P1 | `TabFramingStyle.tsx:369,820,838,856` | **Slider styling pakai `onChange` → PUT `/api/xclips/clips/:id` PER TICK** — `updateSubtitleStyle`/`updatePanOffsetX` memanggil `handleSaveClip` tiap gerakan slider. Drag fontSize = puluhan PUT + set store + re-render per tick. Pakai `onChangeCommitted` (atau debounce 400ms) + update preview lokal di `onChange`. |
| 30 | 🟠 P1 | `xclips.service.ts:1284` + `ytdlp-downloader.ts:844` | **cacheDir scan hanya `.srt`; auto-CC YouTube sering dikirim sebagai `.vtt`** → false negative "Subtitle tidak ditemukan" walau download sukses. DownloadsDir menerima `.vtt` (L1251) tapi `parseSrtToWords` tak bisa parse VTT (header `WEBVTT`, separator desimal `.` bukan `,`, cue-id line). Dua bug saling menutup jadi fitur YT-CC rapuh. |
| 31 | 🟡 P2 | `types.ts:67` + presets | **`autoEmoji` dead flag** — field ada di schema + PRD menjanjikan "emoji otomatis", tapi zero implementasi di canvas overlay & ASS generator. Hapus flag atau implementasi. |
| 32 | 🟡 P2 | `ffmpeg-builder.ts:299-311` | **Karaoke `\k` mengabaikan gap antar kata** — durasi tag = durasi kata saja; silence antar kata tidak dihitung → highlight kata berikut MUNCUL TERLALU CEPAT sebesar gap (timing \k sequential dari Dialogue start). Leading `{\kf}` tanpa durasi = no-op tag. Untuk "subtitle accuracy" (preference user), akumulasi gap dalam frase 6 kata bisa terasa. Fix: hitung gap masuk ke durasi tag kata sebelumnya (`\k` kata i = (start[i+1] - start[i]) * 100 centisec; kata terakhir = end - start). |
| 33 | 🟡 P2 | `studio.types.ts:219` + `StudioTimeline.tsx:132` | `formatTimecodeWithFrames` hardcode `fps=30`; `project.frameRate` tersedia di store tapi tidak dipakai — timecode display salah untuk source 25/60fps. |
| 34 | 🟡 P2 | `xclips.service.ts:995-1006` | Model→provider routing heuristik hardcoded & naming split: `"gemini-3.7-flash"` → provider gemini (butuh GEMINI_API_KEY) vs `"gemini-3-7-flash"` → kieai. Dua konvensi nama untuk satu keluarga model = konfigurasi user mudah salah provider → error "API Key GEMINI belum dikonfigurasi" yang membingungkan. |
| 35 | 🟡 P2 | `xclips-db.ts:75` | `clips.transcriptId` tanpa FK (PRD spec: `REFERENCES ... ON DELETE SET NULL`) → delete track menyisakan dangling reference; diperparah P1-27 (reference diabaikan saat render). |
| 36 | 🟡 P2 | `xclips.service.ts:823-824` | `parseTranscriptWords` filter/map dengan `(w: any)` — zero-any policy violation pada jalur data utama. Ganti dengan `unknown` + type guard atau `WordTimestampSchema` (sudah ada). |
| 37 | 🟡 P2 | `StudioTimeline.tsx:56-57` | Scrubber clamp range pakai clip bounds TANPA mempertimbangkan `subtitleOffsetMs` — saat offset aktif, frase yang tampil di canvas (pakai effective time) bisa berada tepat di luar rentang scrub clip. Minor, dokumentasikan atau perluas clamp. |

## Spec Compliance (PRD-xclips.md & FEATURES.md vs implementasi)

| Spec | Status | Catatan |
|---|---|---|
| "Zero A/V Desync Guarantee" (FEATURES L20) | ❌ VIOLATED | P0-1: ASS drift saat filler removal — justru jaminan inti produk yang dilanggar implementasi sendiri |
| PRD 5.2: chunk 15 mnt + overlap 30 dtk | ⚠️ PARTIAL | chunk 900s OK; overlap 30s TIDAK ada di `transcribeProject` (hanya di `chunkTranscript` untuk highlight discovery) |
| PRD: audio mono 16kHz WAV `/cache/audio/{id}.wav` | ⚠️ DEVIATED | Implementasi: MP3 48k `/cache/{id}/audio_compressed.mp3` — LEBIH BAIK (hemat upload), tapi dokumentasikan agar PRD & kode sinkron |
| PRD: `@tanstack/react-virtual` 60 FPS | ⚠️ DEVIATED | Custom virtualizer — bekerja, tapi viewport hardcode 800px (P1-12). Acceptable; jangan migrasi paksa |
| PRD: emoji otomatis | ❌ MISSING | autoEmoji dead flag (P2-31) |
| PRD: transcripts "explicitly versioned per project" | ✅ OK | Multi-track + isActive implemented + tested |
| PRD KPI: transkripsi <60 dtk utk 30 mnt | ⚠️ RISKY | Timeout 45s (P1-28) bertabrakan realitas latensi |
| PRD: clips.transcript_id FK ON DELETE SET NULL | ❌ MISSING | P2-35 |

## Test Integrity Audit (AI Spec-First Protocol)

Test suite ada: chunker, db, ffmpeg-builder, filler-detector, ytdlp-downloader, logger. Namun **core subtitle-sync TANPA test**:

- `parseSrtToWords` — 0 test (parser SRT: timestamp format, multi-line text, HTML tag strip, block kosong)
- `generateSrtFromWords` (service-local) — 0 test
- `generateAssSubtitles` — 0 test assertion timing/tag (formatAssTime boundary, karaoke tag, positionY↔marginV mapping, excluded words)
- Phrase segmentation (virtualizer/canvas) — 0 test (logika murni, paling mudah dites, justru paling kritis untuk WYSIWYG)
- `remapWordsToKeepTimeline` (yang harus dibuat untuk P0-1) — belum ada fungsi maupun test

Berdasarkan anti-pattern "AI Test Mirroring": test untuk utilitas ini harus ditulis DARI SPESIFIKASI (SRT spec, ASS spec), bukan dari output implementasi saat ini — apalagi implementasi saat ini terbukti punya defect timing. Prioritas test baru: (1) segmentation spec test, (2) ASS timing test, (3) SRT roundtrip test (words → SRT → parseSrtToWords → identical timing), (4) remap test saat implementasi P0-1.

## Updated Summary (Part 1 + Part 2)

- Total findings: 37 (26 + 11 baru)
- P0: 4 (semua masih terbuka; P0-3 separuh membaik)
- P1: 14 (10 lama + 4 baru: transcriptId render, timeout 45s, slider PUT-storm, vtt/srt mismatch)
- P2: 19 (12 lama + 7 baru)

Prioritas eksekusi revisi (menggantikan urutan Part 1):

1. **Batch A — data integrity (±2 jam)**: hapus duplicate route (P0-2) + ASS skip excluded (P1-6) + render pakai `clip.transcriptId` dengan fallback active (P1-27) + SRT match by basename/videoId (P0-4)
2. **Batch B — akurasi sync (±1 hari)**: `remapWordsToKeepTimeline` + spec test (P0-1) + unifikasi segmentation + karaoke gap fix (P2-32)
3. **Batch C — reliability transcribe (±3 jam)**: naikkan timeout single-chunk ke 120-180s (P1-28), concurrency pool + partial-flag (P1-10), VTT handling (P1-30)
4. **Batch D — UI perf (±2 jam)**: slider `onChangeCommitted` (P1-29), auto-save tanpa refetch (P1-9), viewport ResizeObserver (P1-12)
5. **Batch E — cleanup (±2 jam)**: Zod + zero-any (P0-3, P2-36), offset per-track DB (P1-14), dead code & flag (P2-18/19/21/31), FK + PRD sync (P2-35, spec table)

---

# PART 3 — Backend & Performance Audit (audit sesi ketiga, 2026-08-29 22:00)

Fokus: sisi backend & performance secara menyeluruh (bukan hanya jalur subtitle). Files audited: `src/server/index.ts` (1191 LOC, seluruh routes), `src/lib/xclips/xclips-db.ts` (624 LOC, engine penuh), `src/lib/xclips/queue.ts` (render queue), `src/lib/logger.ts` (pino config), TabLogs polling, live runtime state (netstat, ukuran log). Duplicate PUT route dari Part 1 dikonfirmasi masih ada di L983 vs L1103.

## Temuan Highlight (urut dampak)

### B-P0-1. PUT `/api/xclips/clips/:id` TIDAK ADA di server — save clip gagal SILENT 🔴

Store `useStudioStore.ts:632` (`handleSaveClip`) memanggil `PUT /api/xclips/clips/${id}`. Server HANYA punya: `POST /api/xclips/clips` (L1130), `DELETE .../clips/:id` (L1144), `POST .../clips/:id/render` (L1150). Tidak ada PUT handler → Hono return 404 → `apiFetch` return `ok:false` — dan `handleSaveClip` **mengabaikan result** (`await apiFetch(...)` tanpa pengecekan).

Dampak nyata di fitur subtitle & framing: `setStudioAspectRatio`, `setStudioLayoutMode`, `setStudioPanOffsetX`, `setStudioSubtitleStyle` (TabFramingStyle slider fontSize/outline/positionY, preset picker), `updateSubtitleStyle` — SEMUA memanggil `handleSaveClip` → 100% PUT gagal → **subtitleStyle, layoutMode, panOffsetX, aspectRatio TIDAK PERNAH tersimpan ke DB**. Semua styling subtitle yang user atur hilang saat refresh/switch project. Ini menjelaskan bug UX yang pasti sudah/b akan terasa: "kenapa preset hormozi kembali ke plain setelah reload".

Fix: tambahkan `app.put("/api/xclips/clips/:id", ...)` yang validasi body + `xclipsDb.saveClip`. Plus `handleSaveClip` di store harus cek `res.ok` dan surface error (silent failure adalah anti-pattern Result-pattern CODING_PREF).

### B-P0-2. `GET /api/xclips/settings/models` 404 — model list transcribe/highlight tidak pernah ter-load 🔴

Store `useStudioStore.ts:583` memanggil `GET /api/xclips/settings/models?provider=...&apiKey=...`. Route TIDAK ADA di server (yang ada hanya `POST /api/xclips/ai/models` L1005). `fetchAvailableModels` → 404 → catch → `availableHighlightModels: []` → `GenerateSubtitleModal` jatuh ke hardcoded fallback list `["gemini-3-7-flash", "gpt-5-6-terra", "whisper-1"]` (modal L212-214). Model list tidak pernah live; API key dikirim via query param padahal endpoint tak pernah ada.

Fix: ganti store ke `POST /api/xclips/ai/models` (sudah ada, body-based, key tidak ke query string) — sekaligus menutup P1-11 dari Part 1.

### B-P0-3. CORS reflect-any-origin + credentials + listen 0.0.0.0 🟠→🔴 konteks lokal

`src/server/index.ts:18-27`: `origin: (origin) => origin || "*"` + `credentials: true`, dan server listen `0.0.0.0:3351` (terverifikasi netstat). Kombinasi reflect-origin + credentials pada interface yang reachable dari LAN/Tailscale = browser tab malicious di jaringan yang sama bisa memanggil API (transcribe, delete, render, open-in-explorer, download dari URL arbitrer) dengan cookie session. Hono cors origin-callback seperti ini memantulkan SEMUA origin.

Fix: whitelist origin `http://localhost:3350`, `http://127.0.0.1:3350`, Tailscale host; atau turunkan `credentials` (API ini tidak pakai cookie auth sama sekali — `credentials: "include"` di apiFetch juga tidak perlu). Ini local-first tool, bukan multi-user — hardening murah.

### B-P1-4. `/logs` endpoint: full-file read + JSON.parse per baris, SETIAP 2 DETIK, di route yang dikecualikan dari log 🟠

`server/index.ts:545-587`: `fs.readFileSync(logs/app.log)` seluruh file (saat audit: 179 KB dan tumbuh — tiap request API juga nulis log) → split per baris → iterate dari belakang, JSON.parse per baris, filter projectId, sampai 150 entries. TabLogs poll setiap 2000 ms (TabLogs.tsx:353). Untuk sesi panjang + banyak render, file log bisa MB → full read + ratusan parse per 2 detik per client yang membuka tab Logs.

Ironisnya: middleware logging sengaja skip `/logs` (L40) supaya polling tidak menumbuhkan log — tapi semua API call LAIN tetap menulis, jadi file tumbuh terus dan scan makin mahal. Desain logging + polling-nya saling membebani.

Fix (bertahap, tanpa rombak besar):
1. Short-term: baca dari EOF — `fs.open` + `stat` ukuran, baca hanya blok terakhir (mis. 256 KB) dengan `readSync` offset, parse dari belakang. O(ukuran tetap), bukan O(file).
2. Better: pino destination file rotation (pino.roll atau cron) ATAU in-memory ring buffer: logger menulis juga ke `logRingBuffer` (array max 2000 entries) → `/logs` cukup filter buffer, nol disk read.
3. `DELETE /logs` menulis `""` via writeFileSync — cukup truncate via `fs.truncateSync`.

### B-P1-5. Transkrip JSON dibongkar+disimpan ulang berkali-kali (hot path auto-save) 🟠

`xclips-db.ts:311-379`: `getProjectTranscripts` / `getTranscript` melakukan `JSON.parse(row.wordsJson)` untuk setiap row. Kata 30-menit video ≈ 4.000-6.000 kata × ~90 byte JSON = ~500 KB per track. Tiga konsumen paralel:
- auto-save subtitle (tiap idle 1s saat editing) → `saveTranscriptWords` → full rewrite
- `fetchSubtitleTracks` refetch SEMUA track → parse SEMUA wordsJson semua track (lihat P1-9 Part 1)
- TabLogs memicu `fetchAssets` yang juga `getTranscript` → parse lagi
Plus `rawText` + `srtContent` disimpan ulang di setiap save (redundansi P2-20 diperkuat: triple write ~1.5 MB per auto-save tick).

Fix: (1) jangan sertakan `words` di response `GET /subtitles` (metadata saja: id, label, count, dates) — client hanya perlu words saat `switch`; (2) index per-column daripada rawJson-parse-everywhere sudah oke — tapi untuk transcripts, pertimbangkan simpan wordsJson sebagai file per track (vault/xclips/cache/{projectId}/transcripts/{trackId}.json) dan DB hanya metadata — SQLite tidak cocok jadi blob store untuk payload 0.5 MB yang di-parse per request; (3) set `autoSaveStatus` tanpa refetch (Part 1 P1-9).

### B-P1-6. Streaming video: `Bun.file().slice()` benar, tapi sync I/O stat + duplikasi route 4x 🟠

Empat route streaming (media/stream L452, clips/stream L499, media/audio L731, thumbnail L795) menyalin blok range-parsing identik dengan `fs.statSync` (blocking event loop di setiap range request — video player mengirim banyak range request saat seek). Fallback `fs.createReadStream(...) as any` — zero-any violation dan cast tidak aman (Node stream bukan web ReadableStream; hanya selamat karena runtime Bun).

Fix: extract `serveFileWithRange(c, filePath, mime)` helper tunggal + `stat` async (`Bun.file(path).stat()`), hapus branch Node yang mati (project ini Bun-only, `typeof Bun !== "undefined"` selalu true di runtime target). Duplikasi 4x → 1 util.

### B-P1-7. open-in-explorer: exec string-interpola path tanpa escape — command injection 🟠

`server/index.ts:386-391`: `explorer.exe /select,"${absolutePath}"` di-`exec` langsung. Path berasal dari body request (`path` atau `sourcePath` project). Di Windows, path berisi `&` atau metacharacter shell → command execution. Lokal tool risikonya terbatas, tapi path dari URL ingest (YouTube title masuk ke nama file!) mengalir ke sini. Path yang mengandung karakter shell legal di nama file Windows = eksploit nyata.

Fix: gunakan `execFile("explorer.exe", ["/select,", absolutePath])` (array args, tanpa shell) — atau minimal escape quotes. Sama untuk `open -R` di macOS.

### B-P1-8. Assets endpoint men-trigger network fetch + disk write di GET request 🟠

`server/index.ts:616-727` (`GET .../assets`): jika thumbnail belum ada dan project YouTube → `fetch i.ytimg.com` + tulis disk (L638-652). GET yang menulis disk + menunggu network = latency spike + surprise side effect; di polling auto-save storm (P1-9) ini dipanggil berulang. `fetch` tanpa `AbortSignal.timeout` juga melanggar backend standards (AI/HTTP call policy).

Fix: pindah auto-fetch thumbnail ke saat ingest (sekali, di service layer), assets route hanya baca. Semua `fetch` wajib `AbortSignal.timeout(10_000)`.

### B-P1-9. Render queue progress: `saveJob` per ffmpeg stderr tick + SQL dari hot path 🟠

`queue.ts:195-214`: setiap progress tick ffmpeg (banyak per detik) → `xclipsDb.saveJob(job)` (upsert SQL). Dengan 2 job concurrent, itu puluhan upsert/detik ke SQLite WAL — plus setiap `saveJob` INSERT..ON CONFLICT, dan middleware-logger juga nulis log. Tidak fatal (SQLite cepat), tapi write amplification sia-sia + WAL checkpoint pressure.

Fix: throttle saveJob (mis. hanya jika `pct - lastSaved >= 5` atau tiap 2s), simpan progress in-memory (job object di manager), flush saat completed/failed.

### B-P1-10. Background download: floating promise, no task GC, no dedupe 🟠

`server/index.ts:184-235, 309-343`: `(async () => {...})()` tanpa `.catch` (throw di luar try akan unhandled rejection — meski try menutup hampir semua). `activeDownloads` Map TIDAK PERNAH dibersihkan setelah completed/error (memory leak kecil, tapi per sesi panjang + polling 1.2 s interval per task, bisa ratusan entries). Tidak ada dedupe: double-click "download" = dua task yt-dlp men-download file sama bersamaan (race write file sama, dua progress entry).

Fix: `setInterval` GC entries completed >10 menit; dedupe per (url) yang sedang aktif; tambah `.catch` eksplisit; dokumentasikan restart-kehilangan-progress (task state in-memory — P2 catatan PRD alignment: "Stateless: no in-memory state" violated; acceptable untuk local tool, tapi catat).

### B-P2-11. `db.transaction` saveClipsBatch OK, tapi saveTranscript tidak batch-safe vs setActive race 🟡

`saveTranscript` (db:381-414) melakukan UPDATE isActive=0 + upsert di luar transaction. `setActiveTranscript` pakai transaction. Dua writer concurrency (auto-save + switch track) bisa interleave: saveTranscript reset isActive semua → setActive switch → upsert saveTranscript menulis `isActive: 1` untuk track LAMA (karena isNewActive dihitung dari payload, bukan state DB). Race window kecil tapi nyata pada kombinasi auto-save + switch cepat.

Fix: bungkus isi `saveTranscript` dalam `this.db.transaction` (sudah ada pattern di setActiveTranscript).

### B-P2-12. `/api/xclips/projects` GET membongkar rawJson semua project (list view) 🟡

`getAllProjects` parse rawJson per project. Untuk library ratusan project, tiap fetchFootageList mem-parse semuanya. Tidak berat-berat, tapi cukup tambahkan SELECT kolom ringan untuk list (id, name, duration, createdAt) — atau pertahankan rawJson tapi caching in-memory per instance. Low priority.

### B-P2-13. Thumbnail route & download route duplikasi logika YT-fetch + write yang sama 3x 🟡

Auto-fetch thumbnail YouTube diulang di: assets (L638), thumbnail route (L803-820), dan tidak di download-thumbnail (L922-930 pakai frame capture). Tiga tempat, logika identik — extract `ensureThumbnail(projectId): Promise<string|null>`.

### B-P2-14. Log level debug aktif default + file transport unbounded 🟡

`logger.ts:38`: file app.log level `debug` default, tanpa rotation, tanpa maxSize. Dev local masih oke (179 KB setelah ~1 hari), tapi render + transcribe verbose (per-stderr-tick ke log? tidak — hanya progress %, tapi ffmpeg spawn/args log). Tambah `pino.transport` rotation sederhana atau level `info` untuk file; pertimbangkan `LOG_LEVEL` di settings.json. Cost-sensitive: disk murah, tapi /logs endpoint adalah konsumen utama — lihat B-P1-4.

### B-P2-15. `detectFootagePlatform` + fetchYouTubeInfo untuk TikTok/IG via naming salah kaprah 🟡

Route `/footage/info` memanggil `getYouTubeMetadata` untuk URL TikTok/Instagram dengan komentar "works because --dump-json". Berfungsi, tapi penamaan + komentar menyesatkan (maintenance trap). Rename service method `fetchVideoInfo` (di refaktor berikutnya), atau minimal tambahkan log platform.

### B-P2-16. `srt.lineCount` dihitung `split("\n\n").length` 🟡

`server/index.ts:705`: blok SRT = 4 baris (index, timecode, text, kosong), bukan jumlah baris. Nilai yang ditampilkan keliru (menampilkan jumlah blok). Trivial: ganti label ke "blockCount" atau hitung `srtContent.split("\n").length`.

### Yang Sudah Baik (backend, dipertahankan)

- **WAL + busy_timeout + synchronous NORMAL + FK ON** — pragmas SQLite tepat untuk workload ini.
- **Prepared statements + parameter binding** di seluruh hot path DB — tidak ada SQL injection dari parameter.
- **`Bun.file().slice()` untuk range streaming** — zero-copy, pilihan tepat (masalahnya hanya statSync + duplikasi, bukan mekanismenya).
- **Migration runtime idempotent** (`ensureColumns`, legacy UNIQUE migration) — pattern migration yang bagus tanpa framework.
- **Tracing middleware + X-Trace-Id + status-code-aware logging** — observability standar terpenuhi.
- **Render queue concurrency 2 + hwaccel detection cached** — keputusan tepat; maxConcurrent=2 aman untuk CPU encoder.
- **AbortSignal.timeout di semua AI dispatch** — sesuai backend standards.
- **Result pattern konsisten** di service layer.
- **`activeDownloads` progress map** — sederhana dan berfungsi untuk progress polling (cukup + GC).

## Rekomendasi Prioritas Backend & Performance

**Sprint 1 (cepat, dampak besar — ±3 jam):**
1. B-P0-1: tambah PUT `/api/xclips/clips/:id` + cek res.ok di `handleSaveClip` (TANPA ini semua persist styling subtitle mati)
2. B-P0-2: store ganti ke `POST /api/xclips/ai/models` (menutup 404 + query-string key sekaligus)
3. B-P0-3: CORS whitelist localhost + Tailscale, drop `credentials`
4. B-P1-7: `execFile` untuk open-in-explorer

**Sprint 2 (hot path — ±0.5 hari):**
5. B-P1-4: `/logs` baca dari EOF / ring buffer + rotation pino
6. B-P1-5: response `GET /subtitles` tanpa words + auto-save tanpa refetch storm
7. B-P1-9: throttle saveJob progress

**Sprint 3 (hygiene — ±0.5 hari):**
8. B-P1-6: helper `serveFileWithRange` tunggal + stat async
9. B-P1-8: pindah thumbnail auto-fetch ke ingest + AbortSignal di semua fetch
10. B-P1-10: GC + dedupe activeDownloads
11. B-P2-11: transaction saveTranscript; B-P2-16 lineCount; B-P2-14 log level

## Updated Summary (kumulatif Part 1+2+3)

- Total findings: 37 + 16 = **53**
- P0: 4 + 3 baru = **7** (duplicate route, tanpa Zod, salah-ambil SRT, ASS drift, + PUT clips 404, models 404, CORS/0.0.0.0)
- P1: 14 + 7 baru = **21**
- P2: 19 + 6 baru = **25**

Catatan penting untuk perencanaan fix: B-P0-1 (PUT clips 404) adalah temuan paling ACTIONABLE seluruh audit — dampaknya langsung terasa user (styling subtitle tidak persist) dan fixnya satu route + satu pengecekan result. P0-1 Part 1 (ASS drift) tetap yang paling strategis untuk kualitas output.
