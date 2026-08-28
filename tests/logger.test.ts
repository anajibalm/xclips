import { describe, it, expect } from "bun:test";
import {
  rootLogger,
  createScopedLogger,
  generateTraceId,
  httpLogger,
  mediaLogger,
  queueLogger,
} from "@/lib/logger";
import * as fs from "fs";
import * as path from "path";

describe("Structured Logger & Tracing Module", () => {
  it("should generate valid trace IDs with custom prefixes", () => {
    const trace1 = generateTraceId();
    expect(trace1.startsWith("trc_")).toBe(true);

    const jobTrace = generateTraceId("job");
    expect(jobTrace.startsWith("job_")).toBe(true);
  });

  it("should create scoped loggers with context tags", () => {
    const customLogger = createScopedLogger("test:module", { env: "testing" });
    expect(customLogger).toBeDefined();
    expect(typeof customLogger.info).toBe("function");
    expect(typeof customLogger.error).toBe("function");
    expect(typeof customLogger.warn).toBe("function");

    // Write a test log
    customLogger.info({ action: "test_run", sampleData: 123 }, "Test log message executed");
  });

  it("should have pre-configured loggers available", () => {
    expect(httpLogger).toBeDefined();
    expect(mediaLogger).toBeDefined();
    expect(queueLogger).toBeDefined();
    expect(rootLogger).toBeDefined();
  });
});
