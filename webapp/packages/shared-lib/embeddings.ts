import OpenAI from 'openai'

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = 1536
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Track API usage for cost monitoring
interface EmbeddingUsage {
  timestamp: Date
  tokens: number
  cost: number // Approximate cost in USD
  operation: string
}

const usageLog: EmbeddingUsage[] = []

/**
 * Generate embedding for a text string using OpenAI API
 * @param text - Text to embed (title + description for Skill)
 * @param retries - Number of retry attempts remaining
 * @returns Float array of 1536 dimensions
 */
export async function generateEmbedding(
  text: string,
  retries = MAX_RETRIES
): Promise<number[]> {
  try {
    // Truncate text if too long (max ~8000 tokens for text-embedding-3-small)
    const truncatedText = text.slice(0, 32000) // ~8k tokens max

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedText,
      encoding_format: 'float', // Use float for pgvector compatibility
    })

    const embedding = response.data[0].embedding
    const tokens = response.usage.total_tokens

    // Calculate approximate cost ($0.02 per 1M tokens)
    const cost = (tokens / 1_000_000) * 0.02

    // Log usage
    usageLog.push({
      timestamp: new Date(),
      tokens,
      cost,
      operation: 'generate_embedding',
    })

    console.log(`[Embeddings] Generated embedding: ${tokens} tokens, $${cost.toFixed(6)}`)

    return embedding
  } catch (error: any) {
    console.error('[Embeddings] Error generating embedding:', error)

    // Retry with exponential backoff on rate limit or temporary errors
    if (retries > 0 && (error?.status === 429 || error?.status >= 500)) {
      const delay = RETRY_DELAY_MS * (MAX_RETRIES - retries + 1)
      console.log(`[Embeddings] Retrying in ${delay}ms... (${retries} attempts left)`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return generateEmbedding(text, retries - 1)
    }

    throw new Error(`Failed to generate embedding: ${error?.message || error}`)
  }
}

/**
 * Generate embedding from Skill entry (title + description)
 */
export function getSkillEmbeddingText(skill: {
  title: string
  description: string
  type?: string
}): string {
  // Format: "[Type] Title\n\nDescription"
  // This provides context about what the entry is about
  const typePrefix = skill.type ? `[${skill.type.toUpperCase()}] ` : ''
  return `${typePrefix}${skill.title}\n\n${skill.description}`
}

// Simple LRU cache for query embeddings (5 minute TTL)
interface CacheEntry {
  embedding: number[]
  timestamp: number
}

const queryCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Generate embedding with caching (for search queries)
 * @param text - Text to embed
 * @param useCache - Whether to use cache (default: true)
 * @returns Float array of 1536 dimensions
 */
export async function generateEmbeddingWithCache(
  text: string,
  useCache = true
): Promise<number[]> {
  if (useCache) {
    const cached = queryCache.get(text)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log('[Embeddings] Cache hit for query')
      return cached.embedding
    }
  }

  const embedding = await generateEmbedding(text)

  if (useCache) {
    queryCache.set(text, { embedding, timestamp: Date.now() })

    // Simple cache cleanup (remove entries older than TTL)
    if (queryCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of queryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
          queryCache.delete(key)
        }
      }
    }
  }

  return embedding
}

/**
 * Get total API usage statistics
 */
export function getEmbeddingUsageStats() {
  const totalTokens = usageLog.reduce((sum, log) => sum + log.tokens, 0)
  const totalCost = usageLog.reduce((sum, log) => sum + log.cost, 0)
  const requestCount = usageLog.length

  return {
    requestCount,
    totalTokens,
    totalCost,
    averageTokensPerRequest: requestCount > 0 ? totalTokens / requestCount : 0,
    logs: usageLog,
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Used for client-side similarity calculations if needed
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Export constants
export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  version: 1, // Increment if we need to regenerate all embeddings
}
