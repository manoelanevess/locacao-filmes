import prisma from "../prismaClient.js";

type DadosLog = {
  descricao: string;
  complemento?: string;
  usuarioId?: number | null;
};

export async function registrarLog(dados: DadosLog) {
  try {
    await prisma.$executeRaw`
      INSERT INTO logs (descricao, complemento, usuarioId)
      VALUES (${dados.descricao}, ${dados.complemento ?? null}, ${dados.usuarioId ?? null})
    `;
  } catch (error) {
    console.error("Erro ao registrar log:", error);
  }
}
