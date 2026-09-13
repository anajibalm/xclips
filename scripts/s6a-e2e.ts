import * as fs from "node:fs";
import * as path from "node:path";
import { getAutoProductionDeps } from "@/lib/xclips/auto-production-deps";
import {
  rerenderAutoProductionJob,
  runAutoProductionJob,
  type RerenderJobContext,
} from "@/lib/xclips/auto-production-service";
import { xclipsService } from "@/lib/xclips.service";
import { xclipsDb } from "@/lib/xclips/xclips-db";
import {
  buildPlanningCheckpoint,
  hashTranscriptWords,
  parseS6aArgs,
  resolveResumeContext,
} from "@/lib/xclips/e2e-checkpoint";

const parsed = parseS6aArgs(process.argv);
if (parsed.mode === "error") {
  console.error(parsed.error);
  process.exit(1);
}
const outDir = path.resolve(parsed.outDir);
fs.mkdirSync(outDir, { recursive: true });

async function writeCheckpoint(context: RerenderJobContext): Promise<void> {
  const project = xclipsDb.getAllProjects().find((item) => item.sourcePath === context.sourceVideoPath);
  if (!project) throw new Error("PLANNING_PROJECT_MISMATCH");
  const transcript = xclipsDb
    .getProjectTranscripts(project.id)
    .find((item) => hashTranscriptWords(item.words) === hashTranscriptWords(context.transcriptWords));
  if (!transcript) throw new Error("PLANNING_TRANSCRIPT_MISMATCH");
  const settings = xclipsService.getAiSettings();
  const custom = settings.activeCustomProviderId
    ? settings.customProviders.find((item) => item.id === settings.activeCustomProviderId)
    : undefined;
  const checkpoint = buildPlanningCheckpoint({
    context,
    projectId: project.id,
    transcriptId: transcript.id,
    provider: custom ? "openai" : settings.provider,
    model: custom?.plannerModel ?? settings.highlightModel,
  });
  fs.writeFileSync(path.join(outDir, "planning-result.json"), `${JSON.stringify(checkpoint, null, 2)}\n`);
}

const stages: string[] = [];
const onProgress = (s: string): void => {
  stages.push(s);
  console.error(`stage: ${s}`);
};

let sourcePath: string | undefined;
let result;
if (parsed.mode === "resume") {
  const checkpoint = JSON.parse(fs.readFileSync(path.resolve(parsed.checkpointPath), "utf8")) as unknown;
  const context = resolveResumeContext(checkpoint, {
    getProject: (id) => xclipsDb.getProject(id) ?? null,
    getTranscript: (projectId, transcriptId) => xclipsDb.getTranscript(projectId, transcriptId) ?? null,
  });
  sourcePath = context.sourceVideoPath;
  // Resume performs render stages only: no planning, no AI discovery calls.
  result = await rerenderAutoProductionJob({
    context,
    outputDir: path.join(outDir, "render"),
    onProgress,
  });
} else {
  sourcePath = parsed.sourcePath;
  if (!fs.existsSync(sourcePath)) {
    console.error(`source not found: ${sourcePath}`);
    process.exit(1);
  }
  const brief = {
    source: { sourcePath, sourceType: "local" as const },
    editorialAngle: "Sorot pernyataan paling substantif dan jelas dari pembicara",
    editorialFunction: "informasi publik",
    accountPresetId: "kabakom" as const,
    sourceName: path.basename(sourcePath).replace(/\.[^.]+$/, ""),
    accountHandle: "@bakom_ri",
    sensitiveContent: false,
    brollPool: [],
  };
  result = await runAutoProductionJob({
    brief,
    deps: getAutoProductionDeps(),
    outputDir: path.join(outDir, "render"),
    onProgress,
    onPlanningComplete: writeCheckpoint,
  });
}

fs.writeFileSync(
  path.join(outDir, "job-result.json"),
  `${JSON.stringify({ sourcePath, stages, result }, null, 2)}\n`,
);
const failed = "stage" in result ? result.stage : undefined;
const error = "error" in result ? result.error : undefined;
console.log(JSON.stringify({ status: result.status, stage: failed, error }, null, 2));
