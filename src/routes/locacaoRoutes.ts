import { Router, type Request } from "express";
import prisma from "../prismaClient.js";
import { z } from "zod";
import { registrarLog } from "../utils/log.js";
import { verificarToken, type RequisicaoAutenticada } from "../middlewares/autenticacao.js";

const router = Router();

type LocacaoExcluida = {
  id: number;
  clienteId: number;
  filmeId: number;
  quantidade: number;
  formaPagamento: string;
  clienteNome: string;
  filmeTitulo: string;
};

const locacaoSchema = z.object({
  clienteId: z.number().int().positive(),
  filmeId: z.number().int().positive(),
  quantidade: z.number().int().positive(),
  formaPagamento: z.string().max(50),
});

function obterUsuarioId(req: RequisicaoAutenticada) {
  const headerUsuarioId = req.header("usuario-id") ?? req.header("x-usuario-id");
  const bodyUsuarioId = req.body?.usuarioId;
  const usuarioId = Number(req.usuarioId ?? headerUsuarioId ?? bodyUsuarioId);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return null;
  }

  return usuarioId;
}

// listar todas as locacoes
router.get("/", async (req, res) => {
  const locacoes = await prisma.locacao.findMany({
    include: {
      cliente: { select: { id: true, nome: true, email: true } },
      filme: { select: { id: true, titulo: true } },
    },
    orderBy: { dataLocacao: "desc" },
  });
  res.json(locacoes);
});

// buscar locacao por id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const locacao = await prisma.locacao.findUnique({
    where: { id },
    include: { cliente: true, filme: true },
  });
  if (!locacao) {
    res.status(404).json({ erro: "Locacao nao encontrada" });
    return;
  }
  res.json(locacao);
});

// incluir locacao com transacao de estoque
router.post("/", async (req, res) => {
  const dados = locacaoSchema.safeParse(req.body);
  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }

  const { clienteId, filmeId, quantidade, formaPagamento } = dados.data;

  try {
    const locacao = await prisma.$transaction(async (tx) => {
      const filme = await tx.filme.findUnique({ where: { id: filmeId } });
      if (!filme) throw new Error("Filme nao encontrado");

      if (filme.quantidadeDisponivel < quantidade) {
        throw new Error(
          "Estoque insuficiente. Disponivel: " + filme.quantidadeDisponivel
        );
      }

      const novaLocacao = await tx.locacao.create({
        data: { clienteId, filmeId, quantidade, formaPagamento },
      });

      await tx.filme.update({
        where: { id: filmeId },
        data: { quantidadeDisponivel: { decrement: quantidade } },
      });

      return novaLocacao;
    });

    const locacaoCompleta = await prisma.locacao.findUnique({
      where: { id: locacao.id },
      include: { cliente: true, filme: true },
    });

    res.status(201).json(locacaoCompleta);
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro ao criar locacao";
    res.status(400).json({ erro: mensagem });
  }
});

// excluir locacao com transacao de estoque
router.delete("/:id", verificarToken, async (req, res) => {
  const id = Number(req.params.id);
  let locacaoExcluida: LocacaoExcluida | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const locacao = await tx.locacao.findUnique({
        where: { id },
        include: {
          cliente: { select: { nome: true } },
          filme: { select: { titulo: true } },
        },
      });
      if (!locacao) throw new Error("Locacao nao encontrada");

      locacaoExcluida = {
        id: locacao.id,
        clienteId: locacao.clienteId,
        filmeId: locacao.filmeId,
        quantidade: locacao.quantidade,
        formaPagamento: locacao.formaPagamento,
        clienteNome: locacao.cliente.nome,
        filmeTitulo: locacao.filme.titulo,
      };

      await tx.locacao.delete({ where: { id } });

      await tx.filme.update({
        where: { id: locacao.filmeId },
        data: { quantidadeDisponivel: { increment: locacao.quantidade } },
      });
    });

    const locacaoParaLog = locacaoExcluida as LocacaoExcluida | null;

    if (locacaoParaLog?.formaPagamento.trim().toLowerCase() === "dinheiro") {
      await registrarLog({
        descricao: "Acao suspeita: exclusao de locacao paga em dinheiro",
        complemento:
          "Locacao " +
          locacaoParaLog.id +
          " excluida. Cliente: " +
          locacaoParaLog.clienteNome +
          ". Filme: " +
          locacaoParaLog.filmeTitulo +
          ". Quantidade: " +
          locacaoParaLog.quantidade +
          ".",
        usuarioId: obterUsuarioId(req),
      });
    }

    res.json({ mensagem: "Locacao excluida e estoque restaurado com sucesso" });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Erro ao excluir locacao";
    res.status(400).json({ erro: mensagem });
  }
});

export default router;
