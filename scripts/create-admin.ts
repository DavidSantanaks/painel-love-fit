/**
 * Creates (or resets the password of) a panel user.
 *   npm run create-admin -- --email voce@exemplo.com --name "Seu Nome" [--role PLATFORM_ADMIN|ADMIN|RECEPTION] [--franchise lovefit]
 * The password is generated and printed once (or pass PASSWORD=... in the environment).
 */
import { randomBytes } from "node:crypto";
import { hashPassword, passwordProblems } from "../src/server/auth-password";
import { args, db, franchiseFrom, run } from "./lib";

run(async () => {
  const a = args();
  const email = (a.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Informe --email (ex.: --email voce@exemplo.com)');
  const role = (a.role ?? "PLATFORM_ADMIN").toUpperCase();
  if (!["PLATFORM_ADMIN", "ADMIN", "RECEPTION"].includes(role)) throw new Error("--role deve ser PLATFORM_ADMIN, ADMIN ou RECEPTION");

  const password = process.env.PASSWORD || randomBytes(12).toString("base64url") + "A1";
  const problem = passwordProblems(password);
  if (problem) throw new Error(problem);

  const franchise = role === "PLATFORM_ADMIN" ? null : await franchiseFrom(a.franchise);
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email },
    create: { email, name: a.name ?? email.split("@")[0], role: role as never, franchiseId: franchise?.id ?? null, passwordHash },
    update: { passwordHash, role: role as never, franchiseId: franchise?.id ?? null, failedLogins: 0, lockedUntil: null, ...(a.name ? { name: a.name } : {}) },
  });
  await db.session.deleteMany({ where: { userId: user.id } });
  console.log("\nUsuário pronto:");
  console.log(`  e-mail: ${email}`);
  console.log(`  papel:  ${role}${franchise ? ` (${franchise.name})` : " (todas as franquias)"}`);
  if (!process.env.PASSWORD) console.log(`  senha:  ${password}\n\nGuarde a senha agora: ela não aparece de novo.`);
});
