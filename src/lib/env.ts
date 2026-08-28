import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Load .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });

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
