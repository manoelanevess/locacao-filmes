import { Router } from "express";
import nodemailer from "nodemailer";
import prisma from "../prismaClient.js";

const router = Router();

// configuração do Mailtrap (igual ao exemplo do professor)
const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_EMAIL,
    pass: process.env.MAILTRAP_SENHA,
  },
});

// enviar e-mail com o histórico de locações do cliente
router.get("/cliente/:id", async (req, res) => {
  const id = Number(req.params.id);

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      locacoes: {
        include: { filme: true },
        orderBy: { dataLocacao: "desc" },
      },
    },
  });

  if (!cliente) {
    res.status(404).json({ erro: "Cliente não encontrado" });
    return;
  }

  if (cliente.locacoes.length === 0) {
    res.json({ mensagem: "Cliente não possui locações registradas" });
    return;
  }

  const totalGeral = cliente.locacoes.reduce((acc, loc) => acc + (loc.quantidade * loc.filme.valorLocacao), 0);

  const linhas = cliente.locacoes
    .map((loc) => {
      const data = new Date(loc.dataLocacao).toLocaleString("pt-BR");
      const valor = (loc.quantidade * loc.filme.valorLocacao).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${data}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${loc.filme.titulo}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${loc.quantidade}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${valor}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${loc.formaPagamento}</td>
        </tr>`;
    })
    .join("");

  const totalFormatado = totalGeral.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;padding:20px;">
  <div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);">
    <div style="background:#1d4ed8;padding:24px 32px;color:#fff;border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Sistema de Locação de Filmes: Relatório de Locações</h2>
    </div>
    <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0;"><strong>Cliente:</strong> ${cliente.nome}</p>
      <p style="margin:4px 0;"><strong>E-mail:</strong> ${cliente.email}</p>
      <p style="margin:4px 0;"><strong>Telefone:</strong> ${cliente.telefone}</p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;">Data</th>
            <th style="padding:10px 12px;text-align:left;">Filme</th>
            <th style="padding:10px 12px;text-align:center;">Qtd</th>
            <th style="padding:10px 12px;text-align:right;">Valor</th>
            <th style="padding:10px 12px;text-align:center;">Pagamento</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr style="background:#eff6ff;">
            <td colspan="3" style="padding:10px 12px;font-weight:bold;">Total Geral</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;">${totalFormatado}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: '"Sistema de Locação de Filmes" <locacao@filmes.com>',
    to: cliente.email,
    subject: `Locação de Filmes: Relatório de Locações - ${cliente.nome}`,
    html,
  });

  res.json({
    mensagem: `E-mail enviado para ${cliente.email}`,
    totalLocacoes: cliente.locacoes.length,
    totalGeral: totalFormatado,
  });
});

export default router;
