import type { NextFunction, Request, Response } from "express";
import { verificarToken as validarToken } from "../utils/token.js";

export type RequisicaoAutenticada = Request & {
  usuarioId?: number;
  usuarioEmail?: string;
};

export function verificarToken(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    res.status(401).json({ erro: "Token nao informado" });
    return;
  }

  const token = authorization.replace("Bearer ", "").trim();
  const dadosToken = validarToken(token);

  if (!dadosToken) {
    res.status(401).json({ erro: "Token invalido ou expirado" });
    return;
  }

  const reqAutenticada = req as RequisicaoAutenticada;
  reqAutenticada.usuarioId = dadosToken.usuarioId;
  reqAutenticada.usuarioEmail = dadosToken.email;

  next();
}
