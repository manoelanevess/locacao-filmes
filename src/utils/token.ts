import { createHmac, timingSafeEqual } from "node:crypto";

type DadosToken = {
  usuarioId: number;
  email: string;
};

type PayloadToken = DadosToken & {
  exp: number;
};

const SEGREDO_TOKEN = process.env.TOKEN_SECRET ?? "locacao-filmes-token-secreto";
const TEMPO_EXPIRACAO_SEGUNDOS = 60 * 60 * 2;

function codificarBase64Url(valor: string) {
  return Buffer.from(valor).toString("base64url");
}

function decodificarBase64Url(valor: string) {
  return Buffer.from(valor, "base64url").toString("utf8");
}

function assinarToken(header: string, payload: string) {
  return createHmac("sha256", SEGREDO_TOKEN)
    .update(header + "." + payload)
    .digest("base64url");
}

export function gerarToken(dados: DadosToken) {
  const header = codificarBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = codificarBase64Url(
    JSON.stringify({
      usuarioId: dados.usuarioId,
      email: dados.email,
      exp: Math.floor(Date.now() / 1000) + TEMPO_EXPIRACAO_SEGUNDOS,
    })
  );
  const assinatura = assinarToken(header, payload);

  return header + "." + payload + "." + assinatura;
}

export function verificarToken(token: string) {
  const partes = token.split(".");

  if (partes.length !== 3) {
    return null;
  }

  const [header, payload, assinatura] = partes;
  const assinaturaEsperada = assinarToken(header, payload);
  const assinaturaBuffer = Buffer.from(assinatura);
  const assinaturaEsperadaBuffer = Buffer.from(assinaturaEsperada);

  if (assinaturaBuffer.length !== assinaturaEsperadaBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(assinaturaBuffer, assinaturaEsperadaBuffer)) {
    return null;
  }

  try {
    const dados = JSON.parse(decodificarBase64Url(payload)) as PayloadToken;

    if (dados.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      usuarioId: dados.usuarioId,
      email: dados.email,
    };
  } catch (error) {
    return null;
  }
}
