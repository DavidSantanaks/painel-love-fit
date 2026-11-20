import bcrypt from "bcryptjs";

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function passwordProblems(pw: string): string | null {
  if (pw.length < 12) return "A senha precisa ter pelo menos 12 caracteres.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return "Use letras maiúsculas, minúsculas e números.";
  return null;
}
