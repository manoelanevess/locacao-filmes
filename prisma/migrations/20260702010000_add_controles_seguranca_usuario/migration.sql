-- AlterTable
ALTER TABLE `usuarios`
  ADD COLUMN `tentativasLoginInvalidas` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `bloqueado` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `ultimoLogin` DATETIME(3) NULL;
