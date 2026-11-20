import Redis from "ioredis";
import { env } from "./env";
import { log } from "./logger";

const g = globalThis as unknown as { __redis?: Redis };

export function redis(): Redis {
  if (!g.__redis) {
    g.__redis = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
    g.__redis.on("error", (e) => log("error", "redis_error", { error: String(e) }));
  }
  return g.__redis;
}

/** A dedicated connection for blocking commands (BRPOP). */
export function newRedis(): Redis {
  return new Redis(env().REDIS_URL, { maxRetriesPerRequest: null });
}

export const K = {
  queue: "lovefit:inbound",
  seen: (instance: string, id: string) => `lovefit:seen:${instance}:${id}`,
  echo: (instance: string, id: string) => `lovefit:echo:${instance}:${id}`,
  sending: (instance: string, jid: string) => `lovefit:sending:${instance}:${jid}`,
  flood: (instance: string, jid: string) => `lovefit:flood:${instance}:${jid}`,
  lock: (instance: string, jid: string) => `lovefit:lock:${instance}:${jid}`,
  login: (key: string) => `lovefit:login:${key}`,
};
