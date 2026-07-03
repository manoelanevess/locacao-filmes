import { Router } from "express";
import prisma from "../prismaClient.js";
import { verificarToken } from "../middlewares/autenticacao.js";

const router = Router();

type LogLinha = {
  id: number;
  descricao: string;
  complemento: string | null;
  createdAt: Date;
  usuarioId: number | null;
  usuarioNome: string | null;
  usuarioEmail: string | null;
};

function formatarLogs(linhas: LogLinha[]) {
  return linhas.map((log) => ({
    id: log.id,
    descricao: log.descricao,
    complemento: log.complemento,
    createdAt: log.createdAt,
    usuarioId: log.usuarioId,
    usuario: log.usuarioId
      ? {
          id: log.usuarioId,
          nome: log.usuarioNome,
          email: log.usuarioEmail,
        }
      : null,
  }));
}

async function listarLogs(usuarioId?: number) {
  const linhas = usuarioId
    ? await prisma.$queryRaw<LogLinha[]>`
        SELECT logs.id, logs.descricao, logs.complemento, logs.createdAt, logs.usuarioId,
               usuarios.nome AS usuarioNome, usuarios.email AS usuarioEmail
        FROM logs
        LEFT JOIN usuarios ON usuarios.id = logs.usuarioId
        WHERE logs.usuarioId = ${usuarioId}
        ORDER BY logs.createdAt DESC
      `
    : await prisma.$queryRaw<LogLinha[]>`
        SELECT logs.id, logs.descricao, logs.complemento, logs.createdAt, logs.usuarioId,
               usuarios.nome AS usuarioNome, usuarios.email AS usuarioEmail
        FROM logs
        LEFT JOIN usuarios ON usuarios.id = logs.usuarioId
        ORDER BY logs.createdAt DESC
      `;

  return formatarLogs(linhas);
}

function validarUsuarioId(valor: string | undefined) {
  const usuarioId = Number(valor);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return null;
  }

  return usuarioId;
}

router.get("/", verificarToken, async (req, res) => {
  const logs = await listarLogs();

  res.json(logs);
});

router.get("/pesquisar", verificarToken, async (req, res) => {
  const usuarioId = validarUsuarioId(req.query.usuarioId?.toString());

  if (!usuarioId) {
    res.status(400).json({ erro: "Informe um usuarioId valido" });
    return;
  }

  const logs = await listarLogs(usuarioId);

  res.json(logs);
});

router.get("/usuario/:usuarioId", verificarToken, async (req, res) => {
  const usuarioId = validarUsuarioId(req.params.usuarioId?.toString());

  if (!usuarioId) {
    res.status(400).json({ erro: "Informe um usuarioId valido" });
    return;
  }

  const logs = await listarLogs(usuarioId);

  res.json(logs);
});

export default router;
