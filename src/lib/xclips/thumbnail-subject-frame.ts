import * as fs from "fs";
import * as path from "path";
import { extractFrameImage } from "@/lib/xclips/vfr-probe";
import type { Result } from "@/lib/xclips/types";

export interface SubjectFrameInput {
  sourceVideoPath: string;
  outputDir: string;
  timestampSec: number;
}

export async function extractThumbnailSubjectFrame(
  input: SubjectFrameInput,
): Promise<Result<string>> {
  if (!fs.existsSync(input.sourceVideoPath)) {
    return { success: false, error: "Source video does not exist" };
  }
  if (!Number.isFinite(input.timestampSec) || input.timestampSec < 0) {
    return { success: false, error: "Subject frame timestamp must be a non-negative number" };
  }

  const outputPath = path.join(input.outputDir, "subject-frame.jpg");
  const result = await extractFrameImage(input.sourceVideoPath, outputPath, input.timestampSec);
  if (!result.success || !fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    return { success: false, error: result.success ? "Subject frame output is empty" : result.error };
  }
  return { success: true, data: outputPath };
}
