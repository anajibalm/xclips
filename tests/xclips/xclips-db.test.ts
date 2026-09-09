import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { XclipsDatabase } from "@/lib/xclips/xclips-db";
import { XclipsProject, XclipsTranscript, XclipsClip, RenderJob } from "@/lib/xclips/types";

describe("xclips - Persistent SQLite Database Engine (bun:sqlite)", () => {
  let db: XclipsDatabase;

  beforeEach(() => {
    db = new XclipsDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("should initialize database schema cleanly and perform project CRUD", () => {
    const project1: XclipsProject = {
      id: "proj_test_1",
      name: "Podcast Episode 1",
      sourceType: "local",
      sourcePath: "/media/video1.mp4",
      durationSec: 360,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: "2026-08-27T10:00:00.000Z",
      updatedAt: "2026-08-27T10:00:00.000Z",
    };

    const project2: XclipsProject = {
      id: "proj_test_2",
      name: "Interview Session 2",
      sourceType: "youtube",
      sourcePath: "/media/video2.mp4",
      durationSec: 480,
      width: 1920,
      height: 1080,
      frameRate: 60,
      isVfr: true,
      createdAt: "2026-08-27T11:00:00.000Z",
      updatedAt: "2026-08-27T11:00:00.000Z",
    };

    db.saveProject(project1);
    db.saveProject(project2);

    const retrieved1 = db.getProject("proj_test_1");
    expect(retrieved1).not.toBeNull();
    expect(retrieved1?.name).toBe("Podcast Episode 1");
    expect(retrieved1?.durationSec).toBe(360);

    const allProjects = db.getAllProjects();
    expect(allProjects.length).toBe(2);
    // Should be sorted by createdAt DESC (project2 first)
    expect(allProjects[0].id).toBe("proj_test_2");
    expect(allProjects[1].id).toBe("proj_test_1");

    // Update project with masterStyle
    db.saveProject({
      ...project1,
      name: "Podcast Episode 1 (Edited)",
      durationSec: 365,
      masterStyleJson: JSON.stringify({
        aspectRatio: "9:16",
        layoutMode: "blur_bg",
        videoScale: 1.25,
        videoPanX: 0.1,
        videoPanY: -0.05,
        videoRotation: 5,
      }),
    });
    const updated1 = db.getProject("proj_test_1");
    expect(updated1?.name).toBe("Podcast Episode 1 (Edited)");
    expect(updated1?.durationSec).toBe(365);
    expect(updated1?.masterStyle?.videoScale).toBe(1.25);
    expect(updated1?.masterStyle?.videoRotation).toBe(5);
  });

  it("should save and retrieve transcripts with complex word timestamps", () => {
    const project: XclipsProject = {
      id: "proj_trans_1",
      name: "Speech Project",
      sourceType: "local",
      sourcePath: "/media/speech.mp4",
      durationSec: 120,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveProject(project);

    const transcript: XclipsTranscript = {
      id: "trans_1",
      projectId: "proj_trans_1",
      language: "id",
      rawText: "Halo semuanya selamat datang di podcast kami",
      words: [
        { word: "Halo", start: 0.1, end: 0.5, score: 0.95 },
        { word: "semuanya", start: 0.5, end: 1.1, score: 0.98 },
        { word: "selamat", start: 1.2, end: 1.6, score: 0.92 },
        { word: "datang", start: 1.6, end: 2.0, score: 0.96 },
      ],
      srtContent: "1\n00:00:00,100 --> 00:00:02,000\nHalo semuanya selamat datang",
      createdAt: new Date().toISOString(),
    };

    db.saveTranscript(transcript);

    const retrieved = db.getTranscript("proj_trans_1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.rawText).toBe("Halo semuanya selamat datang di podcast kami");
    expect(retrieved?.words.length).toBe(4);
    expect(retrieved?.words[0].word).toBe("Halo");

    // Add a second subtitle track (AI Generated)
    const aiTranscript: XclipsTranscript = {
      id: "tr_ai_2",
      projectId: "proj_trans_1",
      label: "AI: gemini-3-7-flash",
      sourceType: "ai",
      isActive: true,
      language: "id",
      rawText: "Halo kawan selamat datang",
      words: [
        { word: "Halo", start: 0.1, end: 0.4 },
        { word: "kawan", start: 0.5, end: 0.9 },
      ],
      srtContent: "",
      createdAt: new Date().toISOString(),
    };
    db.saveTranscript(aiTranscript);

    // List all tracks for project
    const allTracks = db.getProjectTranscripts("proj_trans_1");
    expect(allTracks.length).toBe(2);

    // Active track should now be aiTranscript
    const activeTrack = db.getTranscript("proj_trans_1");
    expect(activeTrack?.id).toBe("tr_ai_2");

    // Switch active track back to first transcript
    const switchOk = db.setActiveTranscript("proj_trans_1", "trans_1");
    expect(switchOk).toBe(true);
    const switchedTrack = db.getTranscript("proj_trans_1");
    expect(switchedTrack?.id).toBe("trans_1");

    // Delete the second track
    const deleteOk = db.deleteTranscript("proj_trans_1", "tr_ai_2");
    expect(deleteOk).toBe(true);
    const remainingTracks = db.getProjectTranscripts("proj_trans_1");
    expect(remainingTracks.length).toBe(1);
    expect(remainingTracks[0].id).toBe("trans_1");
  });

  it("should atomically save batch clips and rank them by viral score", () => {
    const project: XclipsProject = {
      id: "proj_clips_1",
      name: "Viral Clips Project",
      sourceType: "local",
      sourcePath: "/media/video.mp4",
      durationSec: 600,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveProject(project);

    const defaultStyle = {
      enabled: true,
      preset: "plain" as const,
      fontFamily: "Inter",
      fontSize: 38,
      primaryColor: "#FFFFFF",
      highlightColor: "#FACC15",
      outlineColor: "#000000",
      outlineWidth: 2,
      boxColor: "#000000",
      boxOpacity: 0.7,
      allCaps: false,
      autoEmoji: false,
      positionY: 80,
      karaokeEnabled: true,
    };

    const clip1: XclipsClip = {
      id: "clip_1",
      projectId: "proj_clips_1",
      title: "Hook Pembuka Menarik",
      hookText: "Rahasia sukses nomor satu",
      startSec: 10,
      endSec: 45,
      viralScore: 82,
      aspectRatio: "9:16",
      layoutMode: "blur_bg",
      panOffsetX: 0,
      subtitleStyle: defaultStyle,
      removeFillers: true,
      removeSilence: true,
      customCuts: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const clip2: XclipsClip = {
      id: "clip_2",
      projectId: "proj_clips_1",
      title: "Momen Viral Paling Lucu",
      hookText: "Tiba-tiba terjadi hal tak terduga",
      startSec: 100,
      endSec: 140,
      viralScore: 96,
      aspectRatio: "1:1",
      layoutMode: "center_crop",
      panOffsetX: 0,
      subtitleStyle: defaultStyle,
      removeFillers: true,
      removeSilence: true,
      customCuts: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const clip3: XclipsClip = {
      id: "clip_3",
      projectId: "proj_clips_1",
      title: "Penjelasan Teknis",
      hookText: "Mari kita bahas detail implementasinya",
      startSec: 200,
      endSec: 250,
      viralScore: 65,
      aspectRatio: "16:9",
      layoutMode: "split_screen",
      panOffsetX: 0,
      subtitleStyle: defaultStyle,
      removeFillers: true,
      removeSilence: true,
      customCuts: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save batch atomically
    db.saveClipsBatch([clip1, clip2, clip3]);

    const retrievedClips = db.getClips("proj_clips_1");
    expect(retrievedClips.length).toBe(3);
    // Highest viral score first
    expect(retrievedClips[0].id).toBe("clip_2");
    expect(retrievedClips[0].viralScore).toBe(96);
    expect(retrievedClips[0].aspectRatio).toBe("1:1");
    expect(retrievedClips[1].id).toBe("clip_1");
    expect(retrievedClips[1].viralScore).toBe(82);
    expect(retrievedClips[1].aspectRatio).toBe("9:16");
    expect(retrievedClips[2].id).toBe("clip_3");
    expect(retrievedClips[2].viralScore).toBe(65);
    expect(retrievedClips[2].aspectRatio).toBe("16:9");

    // Delete single clip
    const deleted = db.deleteClip("clip_3");
    expect(deleted).toBe(true);
    expect(db.getClips("proj_clips_1").length).toBe(2);

    // Delete all clips for project
    const allDeleted = db.deleteAllClips("proj_clips_1");
    expect(allDeleted).toBe(true);
    expect(db.getClips("proj_clips_1").length).toBe(0);
  });

  it("should cascade delete transcripts and clips when a project is deleted", () => {
    const project: XclipsProject = {
      id: "proj_cascade_1",
      name: "To Be Deleted",
      sourceType: "local",
      sourcePath: "/media/del.mp4",
      durationSec: 100,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveProject(project);

    db.saveTranscript({
      id: "trans_cascade_1",
      projectId: "proj_cascade_1",
      language: "id",
      rawText: "Sample text",
      srtContent: "",
      words: [{ word: "Sample", start: 0, end: 1 }],
      createdAt: new Date().toISOString(),
    });

    db.saveClip({
      id: "clip_cascade_1",
      projectId: "proj_cascade_1",
      title: "Clip Cascade",
      hookText: "Sample Hook",
      startSec: 0,
      endSec: 30,
      viralScore: 80,
      layoutMode: "blur_bg",
      panOffsetX: 0,
      subtitleStyle: {
        enabled: true,
        preset: "plain",
        fontFamily: "Inter",
        fontSize: 38,
        primaryColor: "#FFFFFF",
        highlightColor: "#FACC15",
        outlineColor: "#000000",
        outlineWidth: 2,
        boxColor: "#000000",
        boxOpacity: 0.7,
        allCaps: false,
        autoEmoji: false,
        positionY: 80,
        karaokeEnabled: true,
      },
      removeFillers: true,
      removeSilence: true,
      customCuts: [],
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(db.getTranscript("proj_cascade_1")).not.toBeNull();
    expect(db.getClips("proj_cascade_1").length).toBe(1);

    // Delete project
    const deleted = db.deleteProject("proj_cascade_1");
    expect(deleted).toBe(true);

    // Associated transcript and clips must be automatically deleted (Cascade)
    expect(db.getProject("proj_cascade_1")).toBeNull();
    expect(db.getTranscript("proj_cascade_1")).toBeNull();
    expect(db.getClips("proj_cascade_1").length).toBe(0);
  });

  it("should save and retrieve render jobs accurately", () => {
    const job: RenderJob = {
      id: "job_render_1",
      clipId: "clip_101",
      projectId: "proj_101",
      status: "rendering",
      progress: 45.5,
      startedAt: new Date().toISOString(),
    };

    db.saveJob(job);
    const retrieved = db.getJob("job_render_1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe("rendering");
    expect(retrieved?.progress).toBe(45.5);

    // Update job to completed
    db.saveJob({
      ...job,
      status: "completed",
      progress: 100,
      outputPath: "/vault/renders/clip_101_916.mp4",
      completedAt: new Date().toISOString(),
    });

    const updated = db.getJob("job_render_1");
    expect(updated?.status).toBe("completed");
    expect(updated?.progress).toBe(100);
    expect(updated?.outputPath).toBe("/vault/renders/clip_101_916.mp4");

    // Verify getActiveJobForClip returns null when job is completed
    expect(db.getActiveJobForClip("clip_101")).toBeNull();

    // Verify getActiveJobForClip returns active job when queued/rendering
    const activeJob: RenderJob = {
      id: "job_render_2",
      clipId: "clip_101",
      projectId: "proj_101",
      status: "queued",
      progress: 0,
      startedAt: new Date().toISOString(),
    };
    db.saveJob(activeJob);
    const retrievedActive = db.getActiveJobForClip("clip_101");
    expect(retrievedActive).not.toBeNull();
    expect(retrievedActive?.id).toBe("job_render_2");
    expect(retrievedActive?.status).toBe("queued");
  });

  it("should return all project IDs and compact database properly", () => {
    const projectA: XclipsProject = {
      id: "proj_ids_a",
      name: "Project A",
      sourceType: "local",
      sourcePath: "/path/to/a.mp4",
      durationSec: 10,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const projectB: XclipsProject = {
      id: "proj_ids_b",
      name: "Project B",
      sourceType: "local",
      sourcePath: "/path/to/b.mp4",
      durationSec: 20,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveProject(projectA);
    db.saveProject(projectB);

    const ids = db.getAllProjectIds();
    expect(ids).toContain("proj_ids_a");
    expect(ids).toContain("proj_ids_b");

    const compactResult = db.compactDatabase();
    expect(compactResult).toBeDefined();
    expect(typeof compactResult.beforeSize).toBe("number");
    expect(typeof compactResult.afterSize).toBe("number");
  });

  it("should perform CRUD on downloads table with filtering and search", () => {
    const record1 = {
      id: "dl_test_1",
      platform: "youtube" as const,
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Rick Astley - Never Gonna Give You Up",
      author: "RickAstleyVEVO",
      durationSec: 213,
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      formatType: "video" as const,
      quality: "1080p" as const,
      filePath: "/vault/xclips/downloads/rick_astley.mp4",
      fileSizeBytes: 25000000,
      status: "completed" as const,
      createdAt: "2026-09-02T10:00:00.000Z",
    };

    const record2 = {
      id: "dl_test_2",
      platform: "tiktok" as const,
      url: "https://www.tiktok.com/@user/video/1234567890",
      title: "Viral Cooking Recipe",
      author: "ChefMaster",
      durationSec: 60,
      thumbnailUrl: "https://p16-va.tiktokcdn.com/cover.jpg",
      formatType: "audio" as const,
      quality: "mp3" as const,
      filePath: "/vault/xclips/downloads/viral_recipe.mp3",
      fileSizeBytes: 2000000,
      status: "completed" as const,
      createdAt: "2026-09-02T11:00:00.000Z",
    };

    db.addDownloadRecord(record1);
    db.addDownloadRecord(record2);

    const fetched1 = db.getDownloadRecordById("dl_test_1");
    expect(fetched1).not.toBeNull();
    expect(fetched1?.title).toBe("Rick Astley - Never Gonna Give You Up");
    expect(fetched1?.platform).toBe("youtube");

    // All records
    const all = db.getDownloadRecords();
    expect(all.length).toBe(2);
    expect(all[0].id).toBe("dl_test_2"); // Sorted DESC

    // Filter by platform
    const ytOnly = db.getDownloadRecords({ platform: "youtube" });
    expect(ytOnly.length).toBe(1);
    expect(ytOnly[0].id).toBe("dl_test_1");

    // Filter by formatType
    const audioOnly = db.getDownloadRecords({ formatType: "audio" });
    expect(audioOnly.length).toBe(1);
    expect(audioOnly[0].id).toBe("dl_test_2");

    // Search
    const searched = db.getDownloadRecords({ search: "Rick" });
    expect(searched.length).toBe(1);
    expect(searched[0].id).toBe("dl_test_1");

    // Update
    db.updateDownloadRecord("dl_test_1", {
      status: "completed",
      fileSizeBytes: 26000000,
      title: "Rick Astley - HD Remastered",
    });
    const updated = db.getDownloadRecordById("dl_test_1");
    expect(updated?.fileSizeBytes).toBe(26000000);
    expect(updated?.title).toBe("Rick Astley - HD Remastered");

    // Delete
    const deleted = db.deleteDownloadRecord("dl_test_2");
    expect(deleted).toBe(true);
    expect(db.getDownloadRecordById("dl_test_2")).toBeNull();
  });

  describe("FK ordering: project must exist before transcript", () => {
    const makeProject = (id: string): XclipsProject => ({
      id,
      name: `Project ${id}`,
      sourceType: "youtube",
      sourcePath: "",
      durationSec: 100,
      width: 1920,
      height: 1080,
      frameRate: 30,
      isVfr: false,
      createdAt: "2026-09-09T00:00:00.000Z",
      updatedAt: "2026-09-09T00:00:00.000Z",
    });

    const makeTranscript = (projectId: string, id: string): XclipsTranscript => ({
      id,
      projectId,
      label: "CC",
      sourceType: "youtube_cc",
      isActive: true,
      language: "id",
      rawText: "test",
      srtContent: "",
      words: [{ word: "test", start: 0, end: 1, confidence: 1 }],
      createdAt: "2026-09-09T00:00:00.000Z",
    });

    it("A. project absent: project saved before transcript", () => {
      const proj = makeProject("proj_fk_1");
      const tr = makeTranscript("proj_fk_1", "tr_fk_1");

      // Save project first (simulates stub creation)
      db.saveProject(proj);
      // Then save transcript (FK satisfied)
      db.saveTranscript(tr);

      const retrieved = db.getTranscript("proj_fk_1", "tr_fk_1");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.projectId).toBe("proj_fk_1");
    });

    it("B. project already exists: transcript still saved", () => {
      const proj = makeProject("proj_fk_2");
      db.saveProject(proj);

      const tr1 = makeTranscript("proj_fk_2", "tr_fk_2a");
      const tr2 = makeTranscript("proj_fk_2", "tr_fk_2b");

      // First transcript saved
      db.saveTranscript(tr1);
      // Second transcript also saved — project is NOT recreated
      db.saveTranscript(tr2);

      expect(db.getTranscript("proj_fk_2", "tr_fk_2a")).not.toBeNull();
      expect(db.getTranscript("proj_fk_2", "tr_fk_2b")).not.toBeNull();
    });

    it("transcript without project violates FK integrity", () => {
      const tr = makeTranscript("proj_nonexistent", "tr_orphan");
      // SQLite FK enforcement: inserting a transcript referencing a non-existent
      // project should throw or violate constraint.
      expect(() => db.saveTranscript(tr)).toThrow();
    });
  });
});

