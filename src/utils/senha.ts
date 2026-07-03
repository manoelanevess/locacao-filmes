import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const senhaSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .regex(/[a-z]/, "A senha deve conter letra minuscula")
  .regex(/[A-Z]/, "A senha deve conter letra maiuscula")
  .regex(/[0-9]/, "A senha deve conter numero")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter caractere especial");

export function gerarHashSenha(senha: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

export function compararSenha(senha: string, senhaHash: string) {
  const [salt, hashSalvo] = senhaHash.split(":");

  if (!salt || !hashSalvo) {
    return false;
  }

  const hashInformado = scryptSync(senha, salt, 64);
  const hashSalvoBuffer = Buffer.from(hashSalvo, "hex");

  if (hashInformado.length !== hashSalvoBuffer.length) {
    return false;
  }

  return timingSafeEqual(hashInformado, hashSalvoBuffer);
}

export function senhaTemDiferencasMinimas(senhaAtual: string, novaSenha: string, minimoDiferencas = 2) {
  const maiorTamanho = Math.max(senhaAtual.length, novaSenha.length);
  let diferencas = 0;

  for (let i = 0; i < maiorTamanho; i++) {
    if (senhaAtual[i] !== novaSenha[i]) {
      diferencas++;
    }

    if (diferencas >= minimoDiferencas) {
      return true;
    }
  }

  return false;
}
