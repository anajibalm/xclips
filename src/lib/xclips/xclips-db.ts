import * as fs from "fs";
import * as path from "path";
import { Database } from "bun:sqlite";
import {
  XclipsProject,
  XclipsTranscript,
  XclipsClip,
  RenderJob,
  ClipStatus,
} from "@/lib/xclips/types";
import { dbLogger } from "@/lib/logger";

const DB_DIR = path.resolve(process.cwd(), "vault", "xclips");
const DB_FILE = path.join(DB_DIR, "xclips.db");

export class XclipsDatabase {
  private db: Database;

  constructor(customPath?: string) {
    const isMemory = customPath === ":memory:";
    if (!isMemory) {
      const targetDir = customPath ? path.dirname(customPath) : DB_DIR;
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = customPath || DB_FILE;
    this.db = new Database(targetPath, { create: true });
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sourceType TEXT NOT NULL DEFAULT 'local',
        sourcePath TEXT NOT NULL,
        durationSec REAL NOT NULL DEFAULT 0,
        width INTEGER NOT NULL DEFAULT 1920,
        height INTEGER NOT NULL DEFAULT 1080,
        frameRate REAL NOT NULL DEFAULT 30,
        fps REAL NOT NULL DEFAULT 30,
        isVfr INTEGER NOT NULL DEFAULT 0,
        normalizedPath TEXT,
        audioPath TEXT,
        masterStyleJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        rawJson TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transcripts (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT 'Subtitle Track',
        sourceType TEXT NOT NULL DEFAULT 'ai',
        isActive INTEGER NOT NULL DEFAULT 1,
        language TEXT NOT NULL DEFAULT 'id',
        rawText TEXT NOT NULL,
        wordsJson TEXT NOT NULL,
        srtContent TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON transcripts(projectId);

      CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        transcriptId TEXT,
        title TEXT NOT NULL,
        hookText TEXT NOT NULL DEFAULT '',
        viralScore REAL NOT NULL DEFAULT 0,
        startSec REAL NOT NULL,
        endSec REAL NOT NULL,
        aspectRatio TEXT NOT NULL DEFAULT '9:16',
        layoutMode TEXT NOT NULL DEFAULT 'blur_bg',
        panOffsetX REAL NOT NULL DEFAULT 0,
        subtitleStyleJson TEXT NOT NULL,
        removeFillers INTEGER NOT NULL DEFAULT 1,
        removeSilence INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        outputPath TEXT,
        renderError TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        rawJson TEXT NOT NULL,
        FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips(projectId);
      CREATE INDEX IF NOT EXISTS idx_clips_viral_score ON clips(viralScore DESC);

      CREATE TABLE IF NOT EXISTS render_jobs (
        id TEXT PRIMARY KEY,
        clipId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        progress REAL NOT NULL DEFAULT 0,
        outputPath TEXT,
        error TEXT,
        startedAt TEXT,
        completedAt TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_render_jobs_clip_id ON render_jobs(clipId);
    `);

    // Auto-migrate schema if tables already existed with older schema
    this.ensureColumns("projects", {
      sourceType: "TEXT NOT NULL DEFAULT 'local'",
      frameRate: "REAL NOT NULL DEFAULT 30",
      fps: "REAL NOT NULL DEFAULT 30",
      normalizedPath: "TEXT",
      audioPath: "TEXT",
      masterStyleJson: "TEXT",
    });

    // Auto-migrate transcripts table if it still has legacy UNIQUE(projectId) constraint
    try {
      const transcriptsSqlRow = this.db.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='transcripts'").get() as { sql?: string } | null;
      if (transcriptsSqlRow?.sql && /projectId\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(transcriptsSqlRow.sql)) {
        dbLogger.info("Migrating transcripts table to remove legacy UNIQUE(projectId) constraint for multi-track support");
        this.db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE transcripts_migration (
            id TEXT PRIMARY KEY,
            projectId TEXT NOT NULL,
            label TEXT NOT NULL DEFAULT 'AI Generated Subtitles',
            sourceType TEXT NOT NULL DEFAULT 'ai',
            isActive INTEGER NOT NULL DEFAULT 1,
            language TEXT NOT NULL DEFAULT 'id',
            rawText TEXT NOT NULL,
            wordsJson TEXT NOT NULL,
            srtContent TEXT NOT NULL DEFAULT '',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(projectId) REFERENCES projects(id) ON DELETE CASCADE
          );
          INSERT OR IGNORE INTO transcripts_migration (
            id, projectId, label, sourceType, isActive, language, rawText, wordsJson, srtContent, createdAt, updatedAt
          )
          SELECT 
            id, 
            projectId, 
            coalesce(label, 'AI Generated Subtitles'), 
            coalesce(sourceType, 'ai'), 
            coalesce(isActive, 1), 
            coalesce(language, 'id'), 
            rawText, 
            wordsJson, 
            coalesce(srtContent, ''), 
            createdAt, 
            coalesce(updatedAt, '') 
          FROM transcripts;
          DROP TABLE transcripts;
          ALTER TABLE transcripts_migration RENAME TO transcripts;
          CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON transcripts(projectId);
          PRAGMA foreign_keys = ON;
        `);
      }
    } catch (migErr) {
      dbLogger.error({ migErr }, "Failed during transcripts table multi-track migration");
    }

    this.ensureColumns("transcripts", {
      label: "TEXT NOT NULL DEFAULT 'Subtitle Track'",
      sourceType: "TEXT NOT NULL DEFAULT 'ai'",
      isActive: "INTEGER NOT NULL DEFAULT 1",
      language: "TEXT NOT NULL DEFAULT 'id'",
      srtContent: "TEXT NOT NULL DEFAULT ''",
      updatedAt: "TEXT NOT NULL DEFAULT ''",
    });

    this.ensureColumns("clips", {
      aspectRatio: "TEXT NOT NULL DEFAULT '9:16'",
      transcriptId: "TEXT",
      hookText: "TEXT NOT NULL DEFAULT ''",
      removeFillers: "INTEGER NOT NULL DEFAULT 1",
      removeSilence: "INTEGER NOT NULL DEFAULT 1",
      renderError: "TEXT",
    });

    this.ensureColumns("render_jobs", {
      startedAt: "TEXT",
      completedAt: "TEXT",
    });

    // Auto-migrate legacy transcripts without proper label or sourceType
    try {
      this.db.exec(`
        UPDATE transcripts
        SET label = 'YouTube Subtitles (CC)', sourceType = 'youtube_cc'
        WHERE (label = 'Subtitle Track' OR label = '' OR label IS NULL)
          AND projectId IN (SELECT id FROM projects WHERE sourceType = 'youtube');
      `);
    } catch {
      // ignore
    }

    dbLogger.info({ dbPath: DB_FILE }, "Initialized SQLite xclips database with WAL mode");
  }

  private ensureColumns(table: string, requiredColumns: Record<string, string>) {
    try {
      const existingRows = this.db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      const existingNames = new Set(existingRows.map((r) => r.name));

      for (const [colName, colDef] of Object.entries(requiredColumns)) {
        if (!existingNames.has(colName)) {
          this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef};`);
          dbLogger.info({ table, colName }, `Auto-migrated missing column: ${table}.${colName}`);
        }
      }
    } catch (err) {
      dbLogger.warn({ table, err }, "Schema migration notice");
    }
  }

  // --- Projects ---
  getAllProjects(): XclipsProject[] {
    try {
      const rows = this.db.query("SELECT rawJson FROM projects ORDER BY datetime(createdAt) DESC").all() as Array<{ rawJson: string }>;
      return rows.map((r) => JSON.parse(r.rawJson));
    } catch (err) {
      dbLogger.error({ err }, "Failed to get all projects");
      return [];
    }
  }

  getProject(id: string): XclipsProject | null {
    try {
      const row = this.db.query("SELECT rawJson FROM projects WHERE id = ?").get(id) as { rawJson: string } | null;
      if (!row) return null;
      return JSON.parse(row.rawJson);
    } catch (err) {
      dbLogger.error({ id, err }, "Failed to get project");
      return null;
    }
  }

  saveProject(project: XclipsProject): void {
    const updatedAt = new Date().toISOString();
    const fpsVal = project.frameRate || 30;

    let masterStyle = project.masterStyle;
    if (!masterStyle && project.masterStyleJson) {
      try {
        masterStyle = JSON.parse(project.masterStyleJson);
      } catch {
        // ignore
      }
    }
    const masterStyleJson = project.masterStyleJson || (masterStyle ? JSON.stringify(masterStyle) : null);

    const updatedProject: XclipsProject = {
      ...project,
      frameRate: fpsVal,
      masterStyle,
      masterStyleJson: masterStyleJson || undefined,
      updatedAt,
    };
    const rawJson = JSON.stringify(updatedProject);

    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, sourceType, sourcePath, durationSec, width, height,
        frameRate, fps, isVfr, normalizedPath, audioPath, masterStyleJson, createdAt, updatedAt, rawJson
      ) VALUES (
        $id, $name, $sourceType, $sourcePath, $durationSec, $width, $height,
        $frameRate, $fps, $isVfr, $normalizedPath, $audioPath, $masterStyleJson, $createdAt, $updatedAt, $rawJson
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        sourceType = excluded.sourceType,
        sourcePath = excluded.sourcePath,
        durationSec = excluded.durationSec,
        width = excluded.width,
        height = excluded.height,
        frameRate = excluded.frameRate,
        fps = excluded.fps,
        isVfr = excluded.isVfr,
        normalizedPath = excluded.normalizedPath,
        audioPath = excluded.audioPath,
        masterStyleJson = excluded.masterStyleJson,
        updatedAt = excluded.updatedAt,
        rawJson = excluded.rawJson
    `);

    stmt.run({
      $id: project.id,
      $name: project.name,
      $sourceType: project.sourceType || "local",
      $sourcePath: project.sourcePath,
      $durationSec: project.durationSec,
      $width: project.width,
      $height: project.height,
      $frameRate: fpsVal,
      $fps: fpsVal,
      $isVfr: project.isVfr ? 1 : 0,
      $normalizedPath: project.normalizedPath || null,
      $audioPath: project.audioPath || null,
      $masterStyleJson: masterStyleJson,
      $createdAt: project.createdAt || updatedAt,
      $updatedAt: updatedAt,
      $rawJson: rawJson,
    });
  }

  deleteProject(id: string): boolean {
    try {
      const stmt = this.db.prepare("DELETE FROM projects WHERE id = ?");
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (err) {
      dbLogger.error({ id, err }, "Failed to delete project");
      return false;
    }
  }

  // --- Transcripts (Multi-Track) ---
  getTranscript(projectId: string, transcriptId?: string): XclipsTranscript | null {
    try {
      let row: any = null;
      if (transcriptId) {
        row = this.db.query("SELECT * FROM transcripts WHERE id = ? AND projectId = ?").get(transcriptId, projectId);
      } else {
        row = this.db.query("SELECT * FROM transcripts WHERE projectId = ? AND isActive = 1 ORDER BY createdAt DESC LIMIT 1").get(projectId);
        if (!row) {
          row = this.db.query("SELECT * FROM transcripts WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1").get(projectId);
        }
      }

      if (!row) return null;
      const resolvedLabel =
        row.label && row.label !== "Subtitle Track"
          ? row.label
          : row.sourceType === "youtube_cc"
          ? "YouTube Subtitles (CC)"
          : "AI Generated Subtitles";

      return {
        id: row.id,
        projectId: row.projectId,
        label: resolvedLabel,
        sourceType: row.sourceType || "ai",
        isActive: Boolean(row.isActive),
        language: row.language || "id",
        rawText: row.rawText,
        words: JSON.parse(row.wordsJson),
        srtContent: row.srtContent || "",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    } catch (err) {
      dbLogger.error({ projectId, transcriptId, err }, "Failed to get transcript");
      return null;
    }
  }

  getProjectTranscripts(projectId: string): XclipsTranscript[] {
    try {
      const rows = this.db.query("SELECT * FROM transcripts WHERE projectId = ? ORDER BY createdAt DESC").all(projectId) as any[];
      return rows.map((row) => {
        const resolvedLabel =
          row.label && row.label !== "Subtitle Track"
            ? row.label
            : row.sourceType === "youtube_cc"
            ? "YouTube Subtitles (CC)"
            : "AI Generated Subtitles";

        return {
          id: row.id,
          projectId: row.projectId,
          label: resolvedLabel,
          sourceType: row.sourceType || "ai",
          isActive: Boolean(row.isActive),
          language: row.language || "id",
          rawText: row.rawText,
          words: JSON.parse(row.wordsJson),
          srtContent: row.srtContent || "",
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      });
    } catch (err) {
      dbLogger.error({ projectId, err }, "Failed to get project transcripts");
      return [];
    }
  }

  saveTranscript(transcript: XclipsTranscript): void {
    const isNewActive = transcript.isActive !== false;
    if (isNewActive) {
      this.db.prepare("UPDATE transcripts SET isActive = 0 WHERE projectId = ?").run(transcript.projectId);
    }

    const stmt = this.db.prepare(`
      INSERT INTO transcripts (id, projectId, label, sourceType, isActive, language, rawText, wordsJson, srtContent, createdAt, updatedAt)
      VALUES ($id, $projectId, $label, $sourceType, $isActive, $language, $rawText, $wordsJson, $srtContent, $createdAt, $updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        sourceType = excluded.sourceType,
        isActive = excluded.isActive,
        language = excluded.language,
        rawText = excluded.rawText,
        wordsJson = excluded.wordsJson,
        srtContent = excluded.srtContent,
        updatedAt = excluded.updatedAt
    `);

    stmt.run({
      $id: transcript.id,
      $projectId: transcript.projectId,
      $label: transcript.label || (transcript.sourceType === "youtube_cc" ? "YouTube CC (Original)" : "AI Generated Subtitles"),
      $sourceType: transcript.sourceType || "ai",
      $isActive: isNewActive ? 1 : 0,
      $language: transcript.language || "id",
      $rawText: transcript.rawText,
      $wordsJson: JSON.stringify(transcript.words),
      $srtContent: transcript.srtContent || "",
      $createdAt: transcript.createdAt || new Date().toISOString(),
      $updatedAt: transcript.updatedAt || new Date().toISOString(),
    });
  }

  setActiveTranscript(projectId: string, transcriptId: string): boolean {
    try {
      this.db.transaction(() => {
        this.db.prepare("UPDATE transcripts SET isActive = 0 WHERE projectId = ?").run(projectId);
        this.db.prepare("UPDATE transcripts SET isActive = 1 WHERE id = ? AND projectId = ?").run(transcriptId, projectId);
      })();
      return true;
    } catch (err) {
      dbLogger.error({ projectId, transcriptId, err }, "Failed to set active transcript");
      return false;
    }
  }

  deleteTranscript(projectId: string, transcriptId: string): boolean {
    try {
      let wasActive = false;
      const target = this.db.query("SELECT isActive FROM transcripts WHERE id = ? AND projectId = ?").get(transcriptId, projectId) as { isActive: number } | null;
      if (target && target.isActive === 1) wasActive = true;

      const res = this.db.prepare("DELETE FROM transcripts WHERE id = ? AND projectId = ?").run(transcriptId, projectId);
      if (res.changes > 0 && wasActive) {
        const remaining = this.db.query("SELECT id FROM transcripts WHERE projectId = ? ORDER BY createdAt DESC LIMIT 1").get(projectId) as { id: string } | null;
        if (remaining) {
          this.db.prepare("UPDATE transcripts SET isActive = 1 WHERE id = ?").run(remaining.id);
        }
      }
      return res.changes > 0;
    } catch (err) {
      dbLogger.error({ projectId, transcriptId, err }, "Failed to delete transcript");
      return false;
    }
  }

  // --- Clips ---
  getClips(projectId: string): XclipsClip[] {
    try {
      const rows = this.db.query(`
        SELECT rawJson FROM clips
        WHERE projectId = ?
        ORDER BY viralScore DESC
      `).all(projectId) as Array<{ rawJson: string }>;
      return rows.map((r) => JSON.parse(r.rawJson));
    } catch (err) {
      dbLogger.error({ projectId, err }, "Failed to get clips");
      return [];
    }
  }

  getClip(id: string): XclipsClip | null {
    try {
      const row = this.db.query("SELECT rawJson FROM clips WHERE id = ?").get(id) as { rawJson: string } | null;
      if (!row) return null;
      return JSON.parse(row.rawJson);
    } catch (err) {
      dbLogger.error({ id, err }, "Failed to get clip");
      return null;
    }
  }

  saveClip(clip: XclipsClip): void {
    const updatedAt = new Date().toISOString();
    const updatedClip: XclipsClip = {
      ...clip,
      updatedAt,
    };
    const rawJson = JSON.stringify(updatedClip);

    const stmt = this.db.prepare(`
      INSERT INTO clips (
        id, projectId, transcriptId, title, hookText, viralScore,
        startSec, endSec, aspectRatio, layoutMode, panOffsetX, subtitleStyleJson,
        removeFillers, removeSilence, status, outputPath, renderError,
        createdAt, updatedAt, rawJson
      ) VALUES (
        $id, $projectId, $transcriptId, $title, $hookText, $viralScore,
        $startSec, $endSec, $aspectRatio, $layoutMode, $panOffsetX, $subtitleStyleJson,
        $removeFillers, $removeSilence, $status, $outputPath, $renderError,
        $createdAt, $updatedAt, $rawJson
      )
      ON CONFLICT(id) DO UPDATE SET
        transcriptId = excluded.transcriptId,
        title = excluded.title,
        hookText = excluded.hookText,
        viralScore = excluded.viralScore,
        startSec = excluded.startSec,
        endSec = excluded.endSec,
        aspectRatio = excluded.aspectRatio,
        layoutMode = excluded.layoutMode,
        panOffsetX = excluded.panOffsetX,
        subtitleStyleJson = excluded.subtitleStyleJson,
        removeFillers = excluded.removeFillers,
        removeSilence = excluded.removeSilence,
        status = excluded.status,
        outputPath = excluded.outputPath,
        renderError = excluded.renderError,
        updatedAt = excluded.updatedAt,
        rawJson = excluded.rawJson
    `);

    stmt.run({
      $id: clip.id,
      $projectId: clip.projectId,
      $transcriptId: clip.transcriptId || null,
      $title: clip.title || "Untitled Clip",
      $hookText: clip.hookText || "",
      $viralScore: clip.viralScore || 0,
      $startSec: clip.startSec,
      $endSec: clip.endSec,
      $aspectRatio: clip.aspectRatio || "9:16",
      $layoutMode: clip.layoutMode || "blur_bg",
      $panOffsetX: clip.panOffsetX || 0,
      $subtitleStyleJson: JSON.stringify(clip.subtitleStyle),
      $removeFillers: clip.removeFillers !== false ? 1 : 0,
      $removeSilence: clip.removeSilence !== false ? 1 : 0,
      $status: clip.status || "draft",
      $outputPath: clip.outputPath || null,
      $renderError: clip.renderError || null,
      $createdAt: clip.createdAt || updatedAt,
      $updatedAt: updatedAt,
      $rawJson: rawJson,
    });
  }

  saveClipsBatch(clips: XclipsClip[]): void {
    if (!clips || clips.length === 0) return;
    const saveTransaction = this.db.transaction((clipsList: XclipsClip[]) => {
      for (const clip of clipsList) {
        this.saveClip(clip);
      }
    });
    saveTransaction(clips);
  }

  deleteClip(id: string): boolean {
    try {
      const stmt = this.db.prepare("DELETE FROM clips WHERE id = ?");
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (err) {
      dbLogger.error({ id, err }, "Failed to delete clip");
      return false;
    }
  }

  // --- Render Jobs ---
  getJob(jobId: string): RenderJob | null {
    try {
      const row = this.db.query("SELECT * FROM render_jobs WHERE id = ?").get(jobId) as {
        id: string;
        clipId: string;
        projectId: string;
        status: ClipStatus;
        progress: number;
        outputPath: string | null;
        error: string | null;
        startedAt: string | null;
        completedAt: string | null;
      } | null;

      if (!row) return null;
      return {
        id: row.id,
        clipId: row.clipId,
        projectId: row.projectId,
        status: row.status,
        progress: row.progress,
        outputPath: row.outputPath || undefined,
        error: row.error || undefined,
        startedAt: row.startedAt || undefined,
        completedAt: row.completedAt || undefined,
      };
    } catch (err) {
      dbLogger.error({ jobId, err }, "Failed to get render job");
      return null;
    }
  }

  saveJob(job: RenderJob): void {
    const stmt = this.db.prepare(`
      INSERT INTO render_jobs (id, clipId, projectId, status, progress, outputPath, error, startedAt, completedAt)
      VALUES ($id, $clipId, $projectId, $status, $progress, $outputPath, $error, $startedAt, $completedAt)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        progress = excluded.progress,
        outputPath = excluded.outputPath,
        error = excluded.error,
        startedAt = excluded.startedAt,
        completedAt = excluded.completedAt
    `);

    stmt.run({
      $id: job.id,
      $clipId: job.clipId,
      $projectId: job.projectId,
      $status: job.status,
      $progress: job.progress || 0,
      $outputPath: job.outputPath || null,
      $error: job.error || null,
      $startedAt: job.startedAt || new Date().toISOString(),
      $completedAt: job.completedAt || null,
    });
  }

  close(): void {
    this.db.close();
  }
}

export const xclipsDb = new XclipsDatabase();
