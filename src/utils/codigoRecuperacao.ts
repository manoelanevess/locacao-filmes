import { randomInt } from "node:crypto";

const CARACTERES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function gerarCodigoRecuperacao() {
  let codigo = "";

  for (let i = 0; i < 4; i++) {
    codigo += CARACTERES[randomInt(0, CARACTERES.length)];
  }

  return codigo;
}
