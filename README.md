# xClips — AI Shorts & Video Clipper Studio

Standalone video clipper extracted from live-assist (2026-08-28). All system, stack, and UI moved verbatim from `D:\@eggafx\live-assist` — zero behavior drift.

## Stack

- Next.js 16 (App Router, static export) + React 19 + TypeScript 7
- MUI v9.3, Pino logger, Zod env validation
- Hono API server (`src/server/index.ts`) — 32 routes `/api/xclips/*`
- SQLite (bun:sqlite, WAL) at `vault/xclips/xclips.db`
- ffmpeg / ffprobe / yt-dlp via child_process
- Tauri v2 desktop shell (`src-tauri/`)

## Ports

| Service | Port |
|---|---|
| Web UI | 3350 |
| Hono API | 3351 |

AI provider keys are stored in `vault/xclips/settings.json` (not env). No auth on API routes — parity with pre-extraction behavior.

## Run

```bash
bun install
bun run dev        # UI :3350
bun run start:api  # API :3351 (separate terminal)
bun test           # 30 tests (xclips + logger suites)
bun run build      # static export -> out/
bun run tauri:dev  # desktop shell
```

## Data

`vault/xclips/` — projects DB (SQLite), media cache, downloads, settings.json.
Backup of pre-extraction state: `D:\@eggafx\backup-xclips-2026-08-28\`.

History: extracted from live-assist per plan `.hermes/plans/2026-08-28_225225-xclips-extraction-plan.md` in the source repo. live-assist web moved to 3360/3361.
