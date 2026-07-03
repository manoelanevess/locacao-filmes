import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { verificarToken, type RequisicaoAutenticada } from "../middlewares/autenticacao.js";
import { gerarCodigoRecuperacao } from "../utils/codigoRecuperacao.js";
import transporter from "../utils/email.js";
import { registrarLog } from "../utils/log.js";
import {
  compararSenha,
  gerarHashSenha,
  senhaSchema,
  senhaTemDiferencasMinimas,
} from "../utils/senha.js";
import { gerarToken } from "../utils/token.js";

const router = Router();

const LIMITE_TENTATIVAS_INVALIDAS = 3;

type UsuarioBanco = {
  id: number;
  nome: string;
  email: string;
  senha: string;
  codigoRecuperacaoSenha: string | null;
  tentativasLoginInvalidas: number;
  bloqueado: boolean;
  ultimoLogin: Date | null;
};

const usuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: senhaSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

const solicitarRecuperacaoSchema = z.object({
  email: z.string().email(),
});

const alterarSenhaSchema = z.object({
  email: z.string().email(),
  codigo: z.string().length(4).transform((codigo) => codigo.toUpperCase()),
  novaSenha: senhaSchema,
});

const alterarSenhaAtualSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: senhaSchema,
});

async function buscarUsuarioPorEmail(email: string) {
  const usuarios = await prisma.$queryRaw<UsuarioBanco[]>`
    SELECT id, nome, email, senha, codigoRecuperacaoSenha,
           tentativasLoginInvalidas, bloqueado, ultimoLogin
    FROM usuarios
    WHERE email = ${email}
    LIMIT 1
  `;

  return usuarios[0] ?? null;
}

async function buscarUsuarioPorId(id: number) {
  const usuarios = await prisma.$queryRaw<UsuarioBanco[]>`
    SELECT id, nome, email, senha, codigoRecuperacaoSenha,
           tentativasLoginInvalidas, bloqueado, ultimoLogin
    FROM usuarios
    WHERE id = ${id}
    LIMIT 1
  `;

  return usuarios[0] ?? null;
}

function escaparHtml(valor: string) {
  const caracteres: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  };

  return valor.replace(/[&<>"']/g, (caracter) => caracteres[caracter]);
}

function formatarUltimoLogin(ultimoLogin: Date | null) {
  if (!ultimoLogin) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(ultimoLogin);
}

router.get("/", async (req, res) => {
  const usuarios = await prisma.$queryRaw<
    Array<{
      id: number;
      nome: string;
      email: string;
      tentativasLoginInvalidas: number;
      bloqueado: boolean;
      ultimoLogin: Date | null;
    }>
  >`
    SELECT id, nome, email, tentativasLoginInvalidas, bloqueado, ultimoLogin
    FROM usuarios
    ORDER BY nome ASC
  `;

  res.json(usuarios);
});

router.post("/", async (req, res) => {
  const dados = usuarioSchema.safeParse(req.body);

  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }

  try {
    const senhaHash = gerarHashSenha(dados.data.senha);

    await prisma.$executeRaw`
      INSERT INTO usuarios (nome, email, senha)
      VALUES (${dados.data.nome}, ${dados.data.email}, ${senhaHash})
    `;

    const usuario = await buscarUsuarioPorEmail(dados.data.email);

    res.status(201).json({
      id: usuario?.id,
      nome: usuario?.nome,
      email: usuario?.email,
    });
  } catch (error) {
    res.status(400).json({ erro: "E-mail ja cadastrado" });
  }
});

router.post("/login", async (req, res) => {
  const dados = loginSchema.safeParse(req.body);

  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }

  const usuario = await buscarUsuarioPorEmail(dados.data.email);

  if (!usuario) {
    await registrarLog({
      descricao: "Tentativa de login invalida",
      complemento: "E-mail nao cadastrado informado no login: " + dados.data.email,
    });

    res.status(401).json({ erro: "E-mail ou senha invalidos" });
    return;
  }

  if (usuario.bloqueado) {
    await registrarLog({
      descricao: "Tentativa de login em usuario bloqueado",
      complemento: "Usuario bloqueado tentou acessar o sistema: " + usuario.email,
      usuarioId: usuario.id,
    });

    res.status(403).json({ erro: "Usuario bloqueado por excesso de tentativas invalidas" });
    return;
  }

  const senhaValida = compararSenha(dados.data.senha, usuario.senha);

  if (!senhaValida) {
    const tentativasAtualizadas = usuario.tentativasLoginInvalidas + 1;
    const deveBloquear = tentativasAtualizadas >= LIMITE_TENTATIVAS_INVALIDAS;

    await prisma.$executeRaw`
      UPDATE usuarios
      SET tentativasLoginInvalidas = ${tentativasAtualizadas},
          bloqueado = ${deveBloquear}
      WHERE id = ${usuario.id}
    `;

    await registrarLog({
      descricao: deveBloquear
        ? "Usuario bloqueado por tentativas invalidas"
        : "Tentativa de login invalida",
      complemento:
        "Senha invalida informada para o e-mail " +
        usuario.email +
        ". Tentativas: " +
        tentativasAtualizadas +
        "/" +
        LIMITE_TENTATIVAS_INVALIDAS +
        ".",
      usuarioId: usuario.id,
    });

    res.status(deveBloquear ? 403 : 401).json({
      erro: deveBloquear
        ? "Usuario bloqueado por excesso de tentativas invalidas"
        : "E-mail ou senha invalidos",
      tentativasRestantes: Math.max(0, LIMITE_TENTATIVAS_INVALIDAS - tentativasAtualizadas),
    });
    return;
  }

  const ultimoLoginAnterior = usuario.ultimoLogin;
  const ultimoLoginFormatado = formatarUltimoLogin(ultimoLoginAnterior);

  await prisma.$executeRaw`
    UPDATE usuarios
    SET tentativasLoginInvalidas = 0,
        ultimoLogin = NOW()
    WHERE id = ${usuario.id}
  `;

  await registrarLog({
    descricao: "Login realizado",
    complemento: "Login realizado pelo usuario " + usuario.email,
    usuarioId: usuario.id,
  });

  const token = gerarToken({ usuarioId: usuario.id, email: usuario.email });

  res.json({
    mensagem: ultimoLoginFormatado
      ? "Bem-vindo, " + usuario.nome + ". Seu ultimo acesso ao sistema foi " + ultimoLoginFormatado
      : "Bem-vindo, " + usuario.nome + ". Este e o seu primeiro acesso ao sistema",
    token,
    ultimoLogin: ultimoLoginAnterior,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
    },
  });
});

router.post("/alterar-senha-simples", verificarToken, async (req, res) => {
  const dados = alterarSenhaAtualSchema.safeParse(req.body);

  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }

  const reqAutenticada = req as RequisicaoAutenticada;

  if (!reqAutenticada.usuarioId) {
    res.status(401).json({ erro: "Usuario nao autenticado" });
    return;
  }

  const usuario = await buscarUsuarioPorId(reqAutenticada.usuarioId);

  if (!usuario) {
    res.status(404).json({ erro: "Usuario nao encontrado" });
    return;
  }

  if (!compararSenha(dados.data.senhaAtual, usuario.senha)) {
    await registrarLog({
      descricao: "Alteracao simples de senha recusada",
      complemento: "Senha atual invalida para o usuario " + usuario.email,
      usuarioId: usuario.id,
    });

    res.status(400).json({ erro: "Senha atual invalida" });
    return;
  }

  if (!senhaTemDiferencasMinimas(dados.data.senhaAtual, dados.data.novaSenha, 2)) {
    res.status(400).json({
      erro: "A nova senha deve ter pelo menos 2 caracteres diferentes da senha atual",
    });
    return;
  }

  await prisma.$executeRaw`
    UPDATE usuarios
    SET senha = ${gerarHashSenha(dados.data.novaSenha)}
    WHERE id = ${usuario.id}
  `;

  await registrarLog({
    descricao: "Senha alterada pelo usuario",
    complemento: "Senha alterada com validacao da senha atual para " + usuario.email,
    usuarioId: usuario.id,
  });

  res.json({ mensagem: "Senha alterada com sucesso" });
});

router.post("/recuperar-senha", async (req, res) => {
  const dados = solicitarRecuperacaoSchema.safeParse(req.body);

  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }

  const usuario = await buscarUsuarioPorEmail(dados.data.email);

  if (!usuario) {
    res.status(404).json({ erro: "Usuario nao encontrado" });
    return;
  }

  const codigo = gerarCodigoRecuperacao();

  await prisma.$executeRaw`
    UPDATE usuarios
    SET codigoRecuperacaoSenha = ${codigo}
    WHERE id = ${usuario.id}
  `;

  const nomeUsuario = escaparHtml(usuario.nome);
  const emailUsuario = escaparHtml(usuario.email);
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:700px;margin:auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden;">
    <div style="background:#1d4ed8;padding:24px 32px;color:#fff;">
      <h2 style="margin:0;font-size:28px;line-height:1.25;">Sistema de Locacao de Filmes: Recuperacao de Senha</h2>
    </div>
    <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb;font-size:16px;color:#111827;">
      <p style="margin:0 0 8px;"><strong>Usuario:</strong> ${nomeUsuario}</p>
      <p style="margin:0;"><strong>E-mail:</strong> ${emailUsuario}</p>
    </div>
    <div style="padding:30px 32px;">
      <p style="margin:0 0 18px;font-size:16px;color:#111827;">Use o codigo abaixo para alterar sua senha no sistema:</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:22px;text-align:center;">
        <p style="margin:0 0 8px;color:#1d4ed8;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Codigo de recuperacao</p>
        <div style="font-size:38px;line-height:1;font-weight:bold;color:#111827;letter-spacing:8px;">${codigo}</div>
      </div>
      <p style="margin:22px 0 0;font-size:14px;color:#4b5563;">Se voce nao solicitou essa recuperacao, ignore este e-mail.</p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: "\"Sistema de Locacao de Filmes\" <locacao@filmes.com>",
    to: usuario.email,
    subject: "Codigo de recuperacao de senha",
    html,
  });

  res.json({ mensagem: "Codigo de recuperacao enviado para " + usuario.email });
});

router.post("/alterar-senha", async (req, res) => {
  const dados = alterarSenhaSchema.safeParse(req.body);

  if (!dados.success) {
    res.status(400).json({ erro: dados.error.issues });
    return;
  }

  const usuario = await buscarUsuarioPorEmail(dados.data.email);

  if (!usuario || usuario.codigoRecuperacaoSenha !== dados.data.codigo) {
    res.status(400).json({ erro: "E-mail ou codigo de recuperacao invalido" });
    return;
  }

  await prisma.$executeRaw`
    UPDATE usuarios
    SET senha = ${gerarHashSenha(dados.data.novaSenha)},
        codigoRecuperacaoSenha = NULL
    WHERE id = ${usuario.id}
  `;

  await registrarLog({
    descricao: "Senha alterada por recuperacao",
    complemento: "Senha alterada com codigo de recuperacao para " + usuario.email,
    usuarioId: usuario.id,
  });

  res.json({ mensagem: "Senha alterada com sucesso" });
});

export default router;
