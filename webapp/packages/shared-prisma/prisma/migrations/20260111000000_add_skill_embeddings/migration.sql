-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "androiduse"."skills"
  ADD COLUMN "embedding" vector(1536),
  ADD COLUMN "embedding_model" TEXT,
  ADD COLUMN "embedding_version" INTEGER DEFAULT 1,
  ADD COLUMN "embedded_at" TIMESTAMP;

-- CreateIndex
-- HNSW index for fast vector similarity search
-- m=16: number of connections per layer (balance between speed and recall)
-- ef_construction=64: size of dynamic candidate list during index building
CREATE INDEX IF NOT EXISTS "skills_embedding_idx"
  ON "androiduse"."skills"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- AddComment
COMMENT ON COLUMN "androiduse"."skills"."embedding" IS 'Vector embedding from OpenAI text-embedding-3-small (1536 dimensions) for semantic search';
