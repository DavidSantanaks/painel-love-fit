/**
 * Background worker started once per server process (see src/instrumentation.ts).
 * - consumes the inbound queue (Redis list): FIFO, ordered per contact, parallel across contacts
 * - daily retention purge of metadata (RNF-07)
 */
import { prisma } from "./db";
import { pipelineDeps } from "./deps";
import { env } from "./env";
import { log } from "./logger";
import { handleInbound } from "./pipeline";
import { K, newRedis } from "./redis";
import type { InboundEvent } from "./webhook-parse";

const g = globalThis as unknown as { __workerStarted?: boolean };

export async function purgeOldMetadata(): Promise<number> {
  const all = await prisma.settings.findMany({ select: { franchiseId: true, retentionDays: true } });
  let total = 0;
  for (const s of all) {
    const cutoff = new Date(Date.now() - s.retentionDays * 86_400_000);
    const a = await prisma.messageLog.deleteMany({ where: { franchiseId: s.franchiseId, createdAt: { lt: cutoff } } });
    const b = await prisma.handoffRequest.deleteMany({ where: { franchiseId: s.franchiseId, resolvedAt: { lt: cutoff } } });
    const c = await prisma.contact.deleteMany({ where: { franchiseId: s.franchiseId, updatedAt: { lt: cutoff } } });
    total += a.count + b.count + c.count;
  }
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return total;
}

/**
 * One reader pops the queue in arrival order (FIFO). Events of the same contact are chained so they
 * run strictly in order (anti-flood keeps the FIRST message); different contacts run in parallel,
 * up to WORKER_CONCURRENCY at a time.
 */
async function loop(concurrency: number) {
  const r = newRedis();
  const deps = pipelineDeps();
  const chains = new Map<string, Promise<void>>();
  let running = 0;
  const waiters: (() => void)[] = [];
  const acquire = () => (running < concurrency ? (running++, Promise.resolve()) : new Promise<void>((res) => waiters.push(() => (running++, res()))));
  const release = () => {
    running--;
    waiters.shift()?.();
  };

  for (;;) {
    try {
      const item = await r.brpop(K.queue, 5);
      if (!item) continue;
      const ev = JSON.parse(item[1]) as InboundEvent;
      const key = `${ev.instance}|${ev.remoteJid}`;
      const prev = chains.get(key) ?? Promise.resolve();
      const next = prev.then(async () => {
        await acquire();
        try {
          await handleInbound(ev, deps);
        } catch (e) {
          log("error", "worker_error", { instance: ev.instance, error: e instanceof Error ? e.message : String(e) });
        } finally {
          release();
        }
      });
      chains.set(key, next);
      void next.then(() => {
        if (chains.get(key) === next) chains.delete(key);
      });
    } catch (e) {
      log("error", "queue_error", { error: e instanceof Error ? e.message : String(e) });
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
}

export function startWorker() {
  if (g.__workerStarted) return;
  g.__workerStarted = true;
  const n = env().WORKER_CONCURRENCY;
  void loop(n);
  log("info", "worker_started", { concurrency: n });

  const runPurge = () =>
    purgeOldMetadata()
      .then((count) => log("info", "retention_purge", { deleted: count }))
      .catch((e) => log("error", "retention_purge_failed", { error: String(e) }));
  setTimeout(runPurge, 60_000);
  setInterval(runPurge, 24 * 3600_000);
}
