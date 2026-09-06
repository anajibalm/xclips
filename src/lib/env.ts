import * as fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const envPath = path.resolve(process.cwd(), ".env");
const envExamplePath = path.resolve(process.cwd(), ".env.example");
const envLocalPath = path.resolve(process.cwd(), ".env.local");

// Initialize .env from .env.example if it does not exist yet
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  try {
    fs.copyFileSync(envExamplePath, envPath);
  } catch {
    // Ignore in read-only environments
  }
}

// Load .env and .env.local quietly to suppress noisy banners
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true, quiet: true });
}

const envSchema = z.object({
  PORT_UI: z.coerce.number().default(3350),
  PORT_API: z.coerce.number().default(3351),
  NEXT_PUBLIC_API_BASE: z.string().default("http://localhost:3351"),
  HERMES_HOME: z.string().optional(),
  VAULT_DIR: z.string().default("vault"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    const parsed = envSchema.safeParse(process.cwd() ? process.env : {});
    if (!parsed.success) {
      console.error("Invalid environment variables:", parsed.error.format());
      throw new Error("Invalid environment variables configuration");
    }
    _env = parsed.data;
  }
  return _env;
}
