import { Router } from "express";
import prisma from "../prismaClient.js";
import { z } from "zod";

const router = Router();

const locacaoSchema = z.object({
  clienteId: z.number().int().positive(),
  filmeId: z.number().int().positive(),
  quantidade: z.number().int().positive(),
  formaPagamento: z.string().max(50),
});

// listar todas as locações
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

// buscar locação por id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const locacao = await prisma.locacao.findUnique({
    where: { id },
    include: { cliente: true, filme: true },
  });
  if (!locacao) {
    res.status(404).json({ erro: "Locação não encontrada" });
    return;
  }
  res.json(locacao);
});

// incluir locação — executa transação
// transação: cria a locação e decrementa o estoque do filme
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
      if (!filme) throw new Error("Filme não encontrado");

      if (filme.quantidadeDisponivel < quantidade) {
        throw new Error(
          `Estoque insuficiente. Disponível: ${filme.quantidadeDisponivel}`
        );
      }

      const novaLocacao = await tx.locacao.create({
        data: { clienteId, filmeId, quantidade, formaPagamento},
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
  } catch (error: any) {
    res.status(400).json({ erro: error.message });
  }
});

// excluir locação — executa transação
// transação: exclui o pagamento vinculado, exclui a locação e restaura o estoque
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  try {
    await prisma.$transaction(async (tx) => {
      const locacao = await tx.locacao.findUnique({ where: { id } });
      if (!locacao) throw new Error("Locação não encontrada");

      await tx.locacao.delete({ where: { id } });

      await tx.filme.update({
        where: { id: locacao.filmeId },
        data: { quantidadeDisponivel: { increment: locacao.quantidade } },
      });
    });

    res.json({ mensagem: "Locação excluída e estoque restaurado com sucesso" });
  } catch (error: any) {
    res.status(400).json({ erro: error.message });
  }
});

export default router;
