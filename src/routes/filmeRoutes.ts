import { Router } from "express";
import prisma from "../prismaClient.js";
import { z } from "zod";

const router = Router();

const filmeSchema = z.object({
  titulo: z.string().min(1),
  genero: z.string().min(1),
  ano: z.number().int(),
  quantidadeDisponivel: z.number().int().min(0),
  valorLocacao: z.number().positive(),
});

// listar todos os filmes
router.get("/", async (req, res) => {
  const filmes = await prisma.filme.findMany({
    orderBy: { titulo: "asc" },
  });
  res.json(filmes);
});

// listar filmes disponíveis
router.get("/disponiveis", async (req, res) => {
  const filmes = await prisma.filme.findMany({
    where: { quantidadeDisponivel: { gt: 0 } },
    orderBy: { titulo: "asc" },
  });
  res.json(filmes);
});

// buscar filme por id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const filme = await prisma.filme.findUnique({ where: { id } });
  if (!filme) {
    res.status(404).json({ erro: "Filme não encontrado" });
    return;
  }
  res.json(filme);
});

// cadastrar filme
router.post("/", async (req, res) => {
  const dados = filmeSchema.safeParse(req.body);
  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }
  const filme = await prisma.filme.create({ data: dados.data });
  res.status(201).json(filme);
});

// atualizar filme
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const dados = filmeSchema.partial().safeParse(req.body);
  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }
  const filme = await prisma.filme.update({
    where: { id },
    data: dados.data,
  });
  res.json(filme);
});

// excluir filme
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.filme.delete({ where: { id } });
  res.json({ mensagem: "Filme excluído com sucesso" });
});

export default router;
