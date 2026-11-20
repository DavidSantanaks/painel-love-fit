import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://redis:6379/1"),
  EVOLUTION_API_URL: z.string().url().default("http://evolution-api:8080"),
  AUTHENTICATION_API_KEY: z.string().min(16, "AUTHENTICATION_API_KEY must have at least 16 chars"),
  WEBHOOK_TOKEN: z.string().min(16, "WEBHOOK_TOKEN must have at least 16 chars"),
  /** URL Evolution uses to reach the app on the internal Docker network. */
  APP_INTERNAL_URL: z.string().url().default("http://app:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must have at least 32 chars"),
  TIMEZONE: z.string().default("America/Sao_Paulo"),
  MEDIA_DIR: z.string().default("/app/data/media"),
  MEDIA_MAX_MB: z.coerce.number().positive().default(10),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  /** "auto" = secure cookie when the request came over HTTPS (Cloudflare Tunnel). */
  COOKIE_SECURE: z.enum(["auto", "true", "false"]).default("auto"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment: ${msg}`);
    }
    cached = parsed.data;
  }
  return cached;
}
