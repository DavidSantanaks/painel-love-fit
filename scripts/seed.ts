/** Idempotent seed: creates the LOVE FIT franchise with the current bot screens (spec §9). */
import { ensureSeed } from "../src/server/seed";
import { db, run } from "./lib";

run(async () => {
  const r = await ensureSeed(db);
  console.log(r.created ? "Seed: franquia LOVE FIT criada com as telas iniciais." : "Seed: já existe conteúdo, nada a fazer.");
});
