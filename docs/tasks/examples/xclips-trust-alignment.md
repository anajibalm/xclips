# Trust Alignment Example

ID: XCLIPS-TRUST-ALIGNMENT
Title: Require trusted physical alignment for production timing
Parent epic: Auto Production

## Goal

Production timing memakai bukti alignment fisik yang lengkap untuk opening dan
ending. Jika bukti tidak cukup, hasil tetap review atau gagal sesuai invariant,
bukan dipaksa menjadi trusted.

## Problem

Timing transcript atau sinyal editorial tidak cukup membuktikan posisi fisik
speech pada media.

## Product invariants

- Trusted timing berasal dari bukti alignment fisik.
- Opening dan ending harus ditemukan.
- Trust tidak boleh dibypass.
- Threshold tidak boleh dilonggarkan diam-diam.
- AI memilih editorial WHAT; trusted timing menentukan physical WHEN.

## Observable PASS

- Bukti alignment lengkap dan konsisten untuk opening serta ending.
- Hasil trusted hanya muncul setelah gate trust dijalankan.
- Bukti, status, dan alasan tersimpan serta dapat diaudit.
- Bukti tidak lengkap tidak dilaporkan sebagai PASS atau `READY`.

## Forbidden shortcuts

- Menganggap YouTube CC timestamp sebagai physical speech truth.
- Mengisi boundary dengan tebakan atau metadata karangan.
- Menangkap error lalu mengembalikan success.
- Melonggarkan threshold atau melewati gate.
- Mengubah expected test agar bug tampak benar.

## Permission boundary

Agent boleh menemukan caller, memilih test, memperbaiki failure teknis, dan
mengulang verification. Keputusan tentang definisi PASS, threshold, risk
tolerance, human attestation, API berbayar, render, migration/deployment, dan
commit/push tetap memerlukan manusia.

## Valid stop states

- `DONE`: invariants dan evidence PASS terbukti.
- `DECISION_REQUIRED`: definisi produk atau threshold belum diputuskan manusia.
- `AUTHORITY_REQUIRED`: operasi atau kewenangan yang dibutuhkan belum diizinkan.
- `BLOCKED`: evidence atau environment tetap tidak cukup setelah repair loop.
