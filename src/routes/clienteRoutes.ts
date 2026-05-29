import { Router } from "express";
import prisma from "../prismaClient.js";
import { z } from "zod";

const router = Router();

const clienteSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().min(1),
});

// listar todos os clientes
router.get("/", async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
  });
  res.json(clientes);
});

// buscar cliente por id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      locacoes: {
        include: { filme: true },
      },
    },
  });
  if (!cliente) {
    res.status(404).json({ erro: "Cliente não encontrado" });
    return;
  }
  res.json(cliente);
});

// cadastrar cliente
router.post("/", async (req, res) => {
  const dados = clienteSchema.safeParse(req.body);
  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }
  const cliente = await prisma.cliente.create({ data: dados.data });
  res.status(201).json(cliente);
});

// atualizar cliente
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const dados = clienteSchema.partial().safeParse(req.body);
  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }
  const cliente = await prisma.cliente.update({
    where: { id },
    data: dados.data,
  });
  res.json(cliente);
});

// excluir cliente
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.cliente.delete({ where: { id } });
  res.json({ mensagem: "Cliente excluído com sucesso" });
});

export default router;
