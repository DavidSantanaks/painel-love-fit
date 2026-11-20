/** npm run create-franchise -- --name "LOVE FIT Centro" --slug centro */
import { cloneFranchise } from "../src/server/seed";
import { args, db, run } from "./lib";

run(async () => {
  const a = args();
  if (!a.name || !a.slug || !/^[a-z0-9-]+$/.test(a.slug)) throw new Error('Use --name "LOVE FIT X" --slug x (slug: minúsculas, números e hífen)');
  const f = await cloneFranchise(db, a.name, a.slug);
  console.log(`Franquia criada: ${f.name} (${f.slug}). Telas e configurações copiadas da LOVE FIT; blacklist, avisos, instâncias e usuários vazios.`);
});
