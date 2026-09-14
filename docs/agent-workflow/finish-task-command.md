# Draft: `finish-task`

Draft repo ini menjelaskan command yang kelak dapat dipasang sebagai
`~/.opencode/commands/finish-task.md`. Dokumen ini tidak memasang atau mengubah
command global.

## Contract

Input wajib: path ticket. Default loop maksimum: lima putaran. Command tidak
stage, commit, atau push kecuali ticket memberi izin eksplisit.

## Proposed command behavior

1. Validasi path ticket, baca root dan scoped `AGENTS.md`, lalu baca ticket.
2. Periksa `git branch --show-current`, `git rev-parse HEAD`, dan `git status --porcelain`.
3. Simpan baseline dirty/untracked dan jangan ubah file baseline.
4. Inspect repository, caller, dependency, docs, dan existing tests.
5. Reproduce current behavior sebelum patch bila memungkinkan.
6. Implementasi smallest change sesuai product contract dan ticket.
7. Jalankan verification yang relevan. Command ECC/OpenCode yang ditemukan saat audit dan boleh dipakai: `/verify`, `/quality-gate`, `/code-review`. `finish-task` belum terpasang sebagai command global.
8. Untuk failure teknis biasa, baca evidence, diagnose, repair, lalu ulangi. Jangan meminta keputusan manusia untuk test merah, typecheck merah, import error, atau caller yang belum ditemukan.
9. Berhenti setelah maksimal lima putaran. Jika putaran habis tanpa hasil, status `BLOCKED` dengan evidence.
10. Audit final diff, allowlist, secret, test claims, dan baseline preservation.
11. Tulis evidence report yang memuat ticket path, branch/HEAD/status awal-akhir, command yang benar-benar dijalankan, hasil tiap gate, file berubah, dan stop state.

## Stop state output

Output wajib diawali satu status baku: `DONE`, `DECISION_REQUIRED`,
`AUTHORITY_REQUIRED`, atau `BLOCKED`.

- `DONE`: acceptance dan verification terbukti.
- `DECISION_REQUIRED`: pertanyaan produk/policy belum punya jawaban manusia.
- `AUTHORITY_REQUIRED`: izin operasi atau kewenangan manusia belum ada.
- `BLOCKED`: blocker teknis/lingkungan/invariant tetap ada setelah repair loop.

## Permission boundary

API berbayar, render, external-cost operation, migration/deployment, destructive
operation, stage, commit, dan push memerlukan izin sesuai ticket. Command tidak
boleh menganggap keberadaan output sebagai PASS tanpa gate yang dijalankan.

## Evidence report shape

```text
Status: DONE | DECISION_REQUIRED | AUTHORITY_REQUIRED | BLOCKED
Ticket: <path>
Baseline: <branch>, <HEAD>, <status summary>
Rounds: <n>/5
Commands run: <exact commands>
Verification: <result and evidence>
Changed files: <paths>
Pre-existing changes preserved: yes/no
Open decisions or authority needed: <none or list>
```
