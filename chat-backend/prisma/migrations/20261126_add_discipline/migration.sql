-- Ajout de la colonne discipline pour partitionner le RAG par événement/discipline
ALTER TABLE "document_chunks"
  ADD COLUMN IF NOT EXISTS "discipline" TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS "document_chunks_discipline_idx"
  ON "document_chunks"("discipline");
