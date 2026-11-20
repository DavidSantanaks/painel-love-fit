/** Manual retention purge (the app also runs it daily). */
import { db, run } from "./lib";

run(async () => {
  const all = await db.settings.findMany();
  for (const s of all) {
    const cutoff = new Date(Date.now() - s.retentionDays * 86_400_000);
    const r = await db.messageLog.deleteMany({ where: { franchiseId: s.franchiseId, createdAt: { lt: cutoff } } });
    console.log(`${s.franchiseId}: ${r.count} registro(s) de log removido(s) (> ${s.retentionDays} dias).`);
  }
});
