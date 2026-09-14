Status: DRAFT
Authority: Human product decisions

# xClips Production Contract

Dokumen ini memisahkan keputusan produk dari fakta repo dan cara implementasi.
Kode, test, dan arsitektur tidak boleh mengubah kontrak ini tanpa keputusan manusia.

## Relationship to Existing MVP PRD

- `docs/product/auto-production-mvp-prd.md` mendefinisikan scope dan tujuan MVP.
- Dokumen ini mendefinisikan invariant produksi dan arti `PASS`.
- Konflik antara keduanya tidak boleh diselesaikan agent.
- Konflik harus menjadi `DECISION_REQUIRED` untuk manusia.

## Clip Selection

- Clip berasal dari statement dalam transkrip.
- Urutan semantik mengikuti urutan ucapan.
- Timestamp tidak boleh menyusun ulang kalimat.

## Headline

- Headline dibuat setelah statement dipilih.
- Headline harus grounded pada clip.
- Ungrounded AI headline boleh diganti fallback ekstraktif.
- Grounding mekanis tidak sama dengan editorial attestation.

## Caption

- Maksimum enam kata per cue.
- Maksimum 3,5 detik.
- Cue tidak overlap.
- Timestamp berasal dari kata.
- Filler tidak dibuang hanya karena klasifikasi editorial.

## Credit

- `sourceName` adalah sumber footage.
- `publisherHandle` adalah akun penerbit output.
- Publisher handle tidak boleh diturunkan dari display name atau channel ID.
- Missing publisher handle harus fail closed.

## Source Date

- Tanggal operator valid menang.
- Platform upload date dapat menjadi fallback.
- Upload date bukan event date.
- Provenance harus dipertahankan.

## Context Integrity

- Hanya manusia yang boleh mengonfirmasi.
- AI tidak boleh mengisi attestasi.
- Tanpa konfirmasi tetap review.

## Physical Trust

- Trusted timing harus berasal dari bukti alignment fisik.
- Opening dan ending harus ditemukan.
- Trust tidak boleh dibypass.
- Threshold tidak boleh dilonggarkan diam-diam.

## Whisper Contract

### CURRENT CONTRACT

- Physical words di luar candidate anchor boleh ada.
- Candidate anchor wajib exact normalized contiguous.
- Candidate minimal 2 dan maksimal 4 kata.
- Tidak ada fuzzy, stemming, edit-distance, atau skip-token matching.

### OPEN DECISION

Apakah physical token tambahan atau hilang di dalam candidate anchor
boleh direkonsiliasi pada masa depan, atau anchor harus selamanya exact
contiguous?

## State Meanings

- `READY`: output dan QC yang diwajibkan kontrak telah tersedia dan lulus; publishable hanya sesuai arti PASS yang disahkan manusia.
- `NEEDS_REVIEW`: output mungkin tersedia, tetapi confidence, provenance, attestation, atau compliance belum cukup untuk `READY`; alasan harus terlihat.
- `FAILED`: pekerjaan teknis tidak selesai atau invariant keras gagal; berbeda dari keraguan editorial.

## OPEN DECISION

- Jumlah clip berdasarkan panjang video.
- Satu atau beberapa clip per sumber.
- Target dan minimum duration.
- Toleransi kehilangan kata caption.
- Deterministic thumbnail untuk `READY`.
- Syarat publish package tanpa image API.
- Apakah tanggal platform cukup untuk publication compliance.
