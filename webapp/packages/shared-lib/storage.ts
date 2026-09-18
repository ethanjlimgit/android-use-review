import { prisma } from './prisma'
import type {
  User,
  App,
  Skill,
  Device,
  BlogPost,
  Task,
  TaskStep,
  UserMemory,
  StepStatus,
  UserToken,
  TokenType,
  Prisma,
} from '@droiduse/shared-prisma/generated/client'
import {
  generateEmbedding,
  generateEmbeddingWithCache,
  getSkillEmbeddingText,
  EMBEDDING_CONFIG
} from './embeddings'

// Types matching the original schema
export type InsertUser = {
  username: string
  password: string
}

export type InsertApp = {
  packagePath: string
  name: string
  version: string
  iconUrl?: string | null
  category?: string | null
}

export type InsertSkill = {
  title: string
  description: string
  appId: string
  authorId?: string | null
  score?: number
  downloads?: number
  featured?: boolean
}

export type InsertDevice = {
  userId?: string | null
  name: string
  deviceId: string
  deviceTypeId: string
  osVersion?: string | null
  status?: string
  fcmToken?: string | null
}

export type InsertBlogPost = {
  title: string
  slug: string
  excerpt?: string | null
  content: string // Markdown content
  authorId: string
  status?: 'draft' | 'published' | 'archived'
  featured?: boolean
  featuredImage?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string | null
  publishedAt?: Date | null
}

export type BlogPostWithAuthor = BlogPost & { author: User | null }
export type BlogPostWithContent = BlogPostWithAuthor & { content: string }

export type SkillWithApp = Skill & { app?: App | null }

export type SkillWithAppAndAuthor = Skill & {
  app?: App | null
  author?: Pick<User, 'id' | 'name' | 'username' | 'image'> | null
  _count?: {
    likes: number
  }
  likes?: { userId: string }[]
}

export type SkillLikeStatus = {
  isLiked: boolean
  likeCount: number
}

// AppSkill has one-to-one mapping with Skill entries
export type AppSkill = SkillWithApp

// Vector search types
export type SearchFilters = {
  tab?: string
  search?: string
  scoreMin?: number
  scoreMax?: number
  authorId?: string
  appId?: string
}

export type SkillSearchResult = SkillWithApp & {
  relevanceScore?: number // Combined score from 0-1
  searchMetadata?: {
    keywordScore: number
    vectorScore?: number
    hasEmbedding: boolean
  }
}

export type UserMemorySearchResult = UserMemory & {
  relevanceScore?: number
  searchMetadata?: {
    keywordScore: number
    vectorScore?: number
    hasEmbedding: boolean
  }
}

export type InsertTask = {
  deviceId: string
  goal: string
  userId?: string | null
  runType?: string | null
  isReasoning?: boolean
}

export type InsertTaskStep = {
  taskId: string
  stepNumber: number
  agentType: string
  status: StepStatus
  actions?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue
  thought?: string | null
  description?: string | null
  subgoal?: string | null
  confidence?: number | null
}

export type InsertUserMemory = {
  userId: string
  type: string
  value: string
  description?: string | null
}

export type InsertUserToken = {
  userId: string
  type: TokenType
  token: string
  expiresAt: Date
}

export type UpdateTaskStep = {
  actions?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue
  status?: StepStatus
  error?: string | null
  summary?: string | null
  fullResponse?: string | null
  a11yTree?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue
  phoneState?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue
  formattedText?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
}

export type TaskWithSteps = Task & {
  taskSteps: TaskStep[]
  device?: Device | null
}

export interface IStorage {
  getUser(id: string): Promise<User | null>
  getUserByUsername(username: string): Promise<User | null>
  createUser(user: InsertUser): Promise<User>

  getApps(): Promise<App[]>
  getApp(id: string): Promise<App | null>
  createApp(app: InsertApp): Promise<App>
  updateApp(id: string, updates: Partial<App>): Promise<App | null>

  getSkills(filters?: {
    tab?: string
    search?: string
    scoreMin?: number
    scoreMax?: number
    authorId?: string
  }): Promise<SkillWithApp[]>
  getSkillById(id: string): Promise<SkillWithApp | null>
  getSkillByIdDetailed(id: string, userId?: string): Promise<SkillWithAppAndAuthor | null>
  createSkill(skill: InsertSkill): Promise<Skill>
  updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null>
  deleteSkill(id: string): Promise<boolean>
  likeSkill(skillId: string, userId: string): Promise<boolean>
  unlikeSkill(skillId: string, userId: string): Promise<boolean>
  getSkillLikeStatus(skillId: string, userId?: string): Promise<SkillLikeStatus>
  // App Skill (one-to-one with skill entries)
  getAppSkill(filters?: { limit?: number; featured?: boolean; appId?: string; packagePath?: string }): Promise<AppSkill[]>
  getAppSkillByPackage(packagePath: string): Promise<AppSkill[]>
  // Vector embedding methods
  generateSkillEmbedding(id: string): Promise<Skill | null>
  searchSkillsWithEmbeddings(query: string, filters?: SearchFilters): Promise<SkillSearchResult[]>
  bulkGenerateEmbeddings(limit?: number): Promise<number>

  getDevices(userId?: string): Promise<Device[]>
  getDevice(id: string): Promise<Device | null>
  createDevice(device: InsertDevice): Promise<Device>
  updateDevice(id: string, updates: Partial<Device>): Promise<Device | null>
  deleteDevice(id: string): Promise<boolean>

  getBlogPosts(filters?: {
    status?: string
    authorId?: string
    featured?: boolean
    search?: string
    limit?: number
    offset?: number
  }): Promise<BlogPostWithAuthor[]>
  getBlogPostBySlug(slug: string, includeContent?: boolean): Promise<BlogPostWithContent | null>
  getBlogPostById(id: string, includeContent?: boolean): Promise<BlogPostWithContent | null>
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>
  updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | null>
  deleteBlogPost(id: string): Promise<boolean>

  // Tasks
  getTasks(filters?: { deviceId?: string; userId?: string; status?: string; limit?: number; includeArchived?: boolean }): Promise<Task[]>
  getTaskById(id: string): Promise<TaskWithSteps | null>
  createTask(task: InsertTask): Promise<Task>
  updateTask(id: string, updates: Prisma.TaskUpdateInput): Promise<Task | null>
  deleteTask(id: string): Promise<boolean>

  // Task Steps
  getTaskSteps(taskId: string): Promise<TaskStep[]>
  createTaskStep(step: InsertTaskStep): Promise<TaskStep>
  updateTaskStep(id: string, updates: UpdateTaskStep): Promise<TaskStep | null>
  getLatestTaskStep(taskId: string): Promise<TaskStep | null>

  // User Memories
  getUserMemories(userId: string, options?: { type?: string }): Promise<UserMemory[]>
  getUserMemoryById(id: string): Promise<UserMemory | null>
  createUserMemory(memory: InsertUserMemory): Promise<UserMemory>
  updateUserMemory(id: string, updates: Partial<UserMemory>): Promise<UserMemory | null>
  deleteUserMemory(id: string): Promise<boolean>
  searchUserMemories(userId: string, query: string, options?: { type?: string; limit?: number }): Promise<UserMemorySearchResult[]>
  generateUserMemoryEmbedding(id: string): Promise<UserMemory | null>

  // User Tokens (Password Reset & Email Verification)
  createPasswordResetToken(data: InsertUserToken): Promise<UserToken>
  getPasswordResetToken(token: string): Promise<UserToken | null>
  markPasswordResetTokenAsUsed(token: string): Promise<boolean>
  deleteExpiredPasswordResetTokens(): Promise<number>
  deleteUserPasswordResetTokens(userId: string): Promise<boolean>

  seedData(): Promise<void>
  prisma: typeof prisma
}

export class DatabaseStorage implements IStorage {
  prisma = prisma

  async getUser(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } })
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { username } })
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return prisma.user.create({ data: insertUser })
  }

  async getApps(): Promise<App[]> {
    return prisma.app.findMany()
  }

  async getApp(id: string): Promise<App | null> {
    return prisma.app.findUnique({ where: { id } })
  }

  async createApp(insertApp: InsertApp): Promise<App> {
    return prisma.app.create({ data: insertApp })
  }

  async updateApp(id: string, updates: Partial<App>): Promise<App | null> {
    return prisma.app.update({
      where: { id },
      data: updates,
    })
  }

  async getSkills(filters?: {
    tab?: string
    search?: string
    scoreMin?: number
    scoreMax?: number
    authorId?: string
  }): Promise<SkillWithApp[]> {
    const where: any = {}

    if (filters?.authorId) {
      where.authorId = filters.authorId
    }

    if (filters?.scoreMin !== undefined) {
      where.score = { ...where.score, gte: filters.scoreMin }
    }

    if (filters?.scoreMax !== undefined) {
      where.score = { ...where.score, lte: filters.scoreMax }
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters?.tab === 'featured') {
      where.featured = true
    }

    const orderBy: any = filters?.tab === 'newest'
      ? { createdAt: 'desc' }
      : { score: 'desc' }

    const results = await prisma.skill.findMany({
      where,
      orderBy,
      include: { app: true },
    })

    return results
  }

  async getSkillById(id: string): Promise<SkillWithApp | null> {
    const k = await prisma.skill.findUnique({
      where: { id },
      include: { app: true },
    })
    return k
  }

  async createSkill(insertSkill: InsertSkill): Promise<Skill> {
    // Create the skill entry first
    const skill = await prisma.skill.create({ data: insertSkill })

    // Generate embedding asynchronously (non-blocking)
    this.generateSkillEmbedding(skill.id).catch((error) => {
      console.error(`[Storage] Background embedding generation failed for ${skill.id}:`, error)
    })

    return skill
  }

  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill | null> {
    const updated = await prisma.skill.update({
      where: { id },
      data: updates,
    })

    // Regenerate embedding if content changed
    if (updates.title || updates.description) {
      this.generateSkillEmbedding(id).catch((error) => {
        console.error(`[Storage] Background embedding regeneration failed for ${id}:`, error)
      })
    }

    return updated
  }

  async deleteSkill(id: string): Promise<boolean> {
    await prisma.skill.delete({ where: { id } })
    return true
  }

  async getSkillByIdDetailed(id: string, userId?: string): Promise<SkillWithAppAndAuthor | null> {
    const includeClause: any = {
      app: true,
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
        },
      },
      _count: {
        select: { likes: true },
      },
    }

    if (userId) {
      includeClause.likes = {
        where: { userId },
        select: { userId: true },
      }
    }

    const skill = await prisma.skill.findUnique({
      where: { id },
      include: includeClause,
    })

    return skill as SkillWithAppAndAuthor | null
  }

  async likeSkill(skillId: string, userId: string): Promise<boolean> {
    try {
      await prisma.skillLike.create({
        data: { skillId, userId },
      })
      return true
    } catch (error) {
      // Handle duplicate like (unique constraint violation)
      return false
    }
  }

  async unlikeSkill(skillId: string, userId: string): Promise<boolean> {
    try {
      await prisma.skillLike.delete({
        where: {
          skillId_userId: {
            skillId,
            userId,
          },
        },
      })
      return true
    } catch (error) {
      return false
    }
  }

  async getSkillLikeStatus(skillId: string, userId?: string): Promise<SkillLikeStatus> {
    // Optimize: Use a single query with conditional aggregation when userId is provided
    if (userId) {
      const [likeCount, userLike] = await Promise.all([
        prisma.skillLike.count({
          where: { skillId },
        }),
        prisma.skillLike.findUnique({
          where: {
            skillId_userId: {
              skillId,
              userId,
            },
          },
          select: { id: true },
        }),
      ])

      return { isLiked: !!userLike, likeCount }
    }

    // If no userId, just get the count
    const likeCount = await prisma.skillLike.count({
      where: { skillId },
    })

    return { isLiked: false, likeCount }
  }

  /**
   * Get app skill entries (one-to-one mapping with skill entries)
   * Returns skill entries with their associated app data
   */
  async getAppSkill(filters?: {
    limit?: number
    featured?: boolean
    appId?: string
    packagePath?: string
  }): Promise<AppSkill[]> {
    const where: any = {}

    if (filters?.featured !== undefined) {
      where.featured = filters.featured
    }

    if (filters?.appId) {
      where.appId = filters.appId
    }

    if (filters?.packagePath) {
      // Find app by package path first
      const app = await prisma.app.findFirst({
        where: { packagePath: filters.packagePath },
      })
      if (app) {
        where.appId = app.id
      } else {
        // No app found, return empty array
        return []
      }
    }

    const skills = await prisma.skill.findMany({
      where,
      include: { app: true },
      orderBy: { score: 'desc' },
      take: filters?.limit,
    })

    return skills
  }

  /**
   * Get app skill entries for a specific package
   */
  async getAppSkillByPackage(packagePath: string): Promise<AppSkill[]> {
    return this.getAppSkill({ packagePath })
  }

  /**
   * Generate embedding for a Skill entry
   */
  async generateSkillEmbedding(id: string): Promise<Skill | null> {
    const skill = await prisma.skill.findUnique({ where: { id } })
    if (!skill) {
      return null
    }

    try {
      // Generate embedding text
      const embeddingText = getSkillEmbeddingText(skill)

      // Call OpenAI API
      const embeddingVector = await generateEmbedding(embeddingText)
      const embeddingStr = `[${embeddingVector.join(',')}]`

      // Use raw SQL to update vector field (Unsupported type in Prisma)
      await prisma.$executeRaw`
        UPDATE androiduse.skills
        SET
          embedding = ${embeddingStr}::vector,
          embedding_model = ${EMBEDDING_CONFIG.model},
          embedding_version = ${EMBEDDING_CONFIG.version}
        WHERE id = ${id}
      `

      console.log(`[Storage] Generated embedding for skill: ${id}`)

      // Fetch updated record
      return prisma.skill.findUnique({ where: { id } })
    } catch (error) {
      console.error(`[Storage] Failed to generate embedding for ${id}:`, error)
      // Don't throw - allow the operation to continue without embedding
      return skill
    }
  }

  /**
   * Hybrid search: Combines keyword matching with vector similarity
   *
   * Strategy:
   * - If query has embeddings: 60% keyword score + 40% vector similarity
   * - If no embeddings: 100% keyword score (graceful degradation)
   *
   * Results are normalized to 0-1 scale and blended
   */
  async searchSkillsWithEmbeddings(
    query: string,
    filters?: SearchFilters
  ): Promise<SkillSearchResult[]> {
    const where: any = {}

    // Apply filters (same as getSkills)
    if (filters?.authorId) where.authorId = filters.authorId
    if (filters?.scoreMin !== undefined) where.score = { ...where.score, gte: filters.scoreMin }
    if (filters?.scoreMax !== undefined) where.score = { ...where.score, lte: filters.scoreMax }
    if (filters?.tab === 'featured') where.featured = true

    // If no search query, use standard sorting
    if (!query || query.trim().length === 0) {
      const orderBy: any = filters?.tab === 'newest' ? { createdAt: 'desc' } : { score: 'desc' }
      const results = await prisma.skill.findMany({
        where,
        orderBy,
        include: { app: true },
        take: 50,
      })
      return results.map((r) => ({ ...r, relevanceScore: 1 }))
    }

    try {
      // Generate embedding for search query
      const queryEmbedding = await generateEmbeddingWithCache(query)
      const embeddingStr = `[${queryEmbedding.join(',')}]`

      // Build filter conditions for raw SQL
      const filterConditions: string[] = []
      const filterParams: any[] = []
      let paramIndex = 1

      if (filters?.authorId) {
        filterConditions.push(`k.author_id = $${paramIndex++}`)
        filterParams.push(filters.authorId)
      }
      if (filters?.appId) {
        filterConditions.push(`k.app_id = $${paramIndex++}`)
        filterParams.push(filters.appId)
      }
      if (filters?.scoreMin !== undefined) {
        filterConditions.push(`k.score >= $${paramIndex++}`)
        filterParams.push(filters.scoreMin)
      }
      if (filters?.scoreMax !== undefined) {
        filterConditions.push(`k.score <= $${paramIndex++}`)
        filterParams.push(filters.scoreMax)
      }
      if (filters?.tab === 'featured') {
        filterConditions.push(`k.featured = true`)
      }

      const filterClause = filterConditions.length > 0 ? 'AND ' + filterConditions.join(' AND ') : ''

      // Hybrid search using raw SQL for vector operations
      const results = await prisma.$queryRawUnsafe<any[]>(`
        WITH
        -- Keyword search using PostgreSQL full-text search
        keyword_results AS (
          SELECT
            k.id,
            ts_rank(
              to_tsvector('english', k.title || ' ' || k.description),
              plainto_tsquery('english', $${paramIndex})
            ) as keyword_score
          FROM "androiduse"."skills" k
          WHERE to_tsvector('english', k.title || ' ' || k.description) @@ plainto_tsquery('english', $${paramIndex})
        ),
        -- Vector similarity search
        vector_results AS (
          SELECT
            k.id,
            1 - (k.embedding <=> $${paramIndex + 1}::vector) as vector_score
          FROM "androiduse"."skills" k
          WHERE k.embedding IS NOT NULL
        ),
        -- Combine scores
        combined_scores AS (
          SELECT
            k.id,
            COALESCE(kr.keyword_score, 0) * 0.6 + COALESCE(vr.vector_score, 0) * 0.4 as relevance_score,
            COALESCE(kr.keyword_score, 0) as keyword_score,
            vr.vector_score,
            (k.embedding IS NOT NULL) as has_embedding
          FROM "androiduse"."skills" k
          LEFT JOIN keyword_results kr ON k.id = kr.id
          LEFT JOIN vector_results vr ON k.id = vr.id
          WHERE
            (kr.keyword_score > 0 OR vr.vector_score IS NOT NULL)
            ${filterClause}
        )
        SELECT
          k.*,
          cs.relevance_score,
          cs.keyword_score,
          cs.vector_score,
          cs.has_embedding
        FROM combined_scores cs
        JOIN "androiduse"."skills" k ON k.id = cs.id
        ORDER BY cs.relevance_score DESC
        LIMIT 50
      `, ...filterParams, query, embeddingStr)

      // Enrich results with app data and format
      const enriched = await Promise.all(
        results.map(async (r) => {
          const app = r.app_id ? await prisma.app.findUnique({ where: { id: r.app_id } }) : null
          return {
            ...r,
            app,
            relevanceScore: r.relevance_score,
            searchMetadata: {
              keywordScore: r.keyword_score,
              vectorScore: r.vector_score,
              hasEmbedding: r.has_embedding,
            },
          }
        })
      )

      // Generate embeddings for results without them (async, non-blocking)
      enriched.forEach((result) => {
        if (!result.searchMetadata.hasEmbedding) {
          this.generateSkillEmbedding(result.id).catch(() => {})
        }
      })

      return enriched
    } catch (error) {
      console.error('[Storage] Embedding search failed, falling back to keyword:', error)

      // Fallback to keyword-only search
      return this.getSkills({ ...filters, search: query })
    }
  }

  /**
   * Bulk generate embeddings for existing entries (for gradual backfill)
   * Can be called manually or via cron job
   */
  async bulkGenerateEmbeddings(limit: number = 100): Promise<number> {
    // Find entries without embeddings
    const skillsWithoutEmbeddings = await prisma.skill.findMany({
      where: {
        embedding: null, // Unsupported type
      } as any,
      take: limit,
      orderBy: { score: 'desc' }, // Prioritize high-score entries
    })

    console.log(`[Storage] Generating embeddings for ${skillsWithoutEmbeddings.length} entries`)

    let successCount = 0
    for (const skill of skillsWithoutEmbeddings) {
      try {
        await this.generateSkillEmbedding(skill.id)
        successCount++
      } catch (error) {
        console.error(`[Storage] Failed to generate embedding for ${skill.id}:`, error)
      }
    }

    return successCount
  }

  async getDevices(userId?: string): Promise<Device[]> {
    if (userId) {
      return prisma.device.findMany({ where: { userId } })
    }
    return prisma.device.findMany()
  }

  async getDevice(id: string): Promise<Device | null> {
    return prisma.device.findUnique({ where: { id } })
  }

  async getDeviceByDeviceId(deviceId: string): Promise<Device | null> {
    return prisma.device.findUnique({ where: { deviceId } })
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    return prisma.device.create({ data: insertDevice })
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device | null> {
    return prisma.device.update({
      where: { id },
      data: updates,
    })
  }

  async deleteDevice(id: string): Promise<boolean> {
    await prisma.device.delete({ where: { id } })
    return true
  }

  async getBlogPosts(filters?: {
    status?: string
    authorId?: string
    featured?: boolean
    search?: string
    limit?: number
    offset?: number
  }): Promise<BlogPostWithAuthor[]> {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.authorId) {
      where.authorId = filters.authorId
    }

    if (filters?.featured !== undefined) {
      where.featured = filters.featured
    }

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { excerpt: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const results = await prisma.blogPost.findMany({
      where,
      include: { author: true },
      orderBy: { publishedAt: 'desc' },
      take: filters?.limit,
      skip: filters?.offset,
    })

    return results
  }

  async getBlogPostBySlug(slug: string, includeContent: boolean = false): Promise<BlogPostWithContent | null> {
    if (includeContent) {
      const post = await prisma.blogPost.findUnique({
        where: { slug },
        include: { author: true },
      })

      if (!post) {
        return null
      }

      return { ...post, content: post.content || '' }
    } else {
      // Optimize: exclude content field when not needed
      const post = await prisma.blogPost.findUnique({
        where: { slug },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          authorId: true,
          status: true,
          featured: true,
          featuredImage: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          author: true,
        },
      })

      if (!post) {
        return null
      }

      return { ...post, content: '' } as BlogPostWithContent
    }
  }

  async getBlogPostById(id: string, includeContent: boolean = false): Promise<BlogPostWithContent | null> {
    if (includeContent) {
      const post = await prisma.blogPost.findUnique({
        where: { id },
        include: { author: true },
      })

      if (!post) {
        return null
      }

      return { ...post, content: post.content || '' }
    } else {
      // Optimize: exclude content field when not needed
      const post = await prisma.blogPost.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          authorId: true,
          status: true,
          featured: true,
          featuredImage: true,
          seoTitle: true,
          seoDescription: true,
          seoKeywords: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          author: true,
        },
      })

      if (!post) {
        return null
      }

      return { ...post, content: '' } as BlogPostWithContent
    }
  }

  async createBlogPost(insertBlogPost: InsertBlogPost): Promise<BlogPost> {
    // Create blog post in database with content stored directly
    const post = await prisma.blogPost.create({
      data: insertBlogPost,
    })

    return post
  }

  async updateBlogPost(id: string, updates: Partial<InsertBlogPost>): Promise<BlogPost | null> {
    const existingPost = await prisma.blogPost.findUnique({ where: { id } })
    if (!existingPost) {
      return null
    }

    // Update blog post in database (content is stored directly)
    return prisma.blogPost.update({
      where: { id },
      data: updates,
    })
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const post = await prisma.blogPost.findUnique({ where: { id } })
    if (!post) {
      return false
    }

    // Delete from database (content is stored in DB, no file to delete)
    await prisma.blogPost.delete({ where: { id } })
    return true
  }

  // Task Methods
  async getTasks(filters?: {
    deviceId?: string
    userId?: string
    status?: string
    limit?: number
    cursor?: string
    includeArchived?: boolean
  }): Promise<Task[]> {
    const where: any = {}

    if (filters?.deviceId) {
      where.deviceId = filters.deviceId
    }

    if (filters?.userId) {
      where.userId = filters.userId
    }

    if (filters?.status) {
      where.status = filters.status
    }

    // By default, exclude archived tasks
    if (!filters?.includeArchived) {
      where.archivedAt = null
    }

    return prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit,
      ...(filters?.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        device: { select: { id: true, name: true, deviceId: true } },
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { taskSteps: true } },
      },
    })
  }

  async getTaskById(id: string): Promise<TaskWithSteps | null> {
    return prisma.task.findUnique({
      where: { id },
      include: {
        taskSteps: {
          orderBy: { createdAt: 'asc' },
        },
        device: {
          include: {
            deviceType: true,
          },
        },
      },
    })
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const task = await prisma.task.create({
      data: insertTask,
    })

    // Generate and store embedding for the task goal (fire-and-forget)
    generateEmbedding(insertTask.goal)
      .then(async (embedding) => {
        const embeddingStr = `[${embedding.join(",")}]`
        await prisma.$executeRawUnsafe(
          `UPDATE "androiduse"."tasks" SET embedding = $1::vector, embedding_model = $2 WHERE id = $3`,
          embeddingStr,
          EMBEDDING_CONFIG.model,
          task.id
        )
        console.log(`[Tasks] Stored embedding for task ${task.id}`)
      })
      .catch((err) => {
        console.error(`[Tasks] Failed to generate embedding for task ${task.id}:`, err)
      })

    return task
  }

  async updateTask(id: string, updates: Prisma.TaskUpdateInput): Promise<Task | null> {
    return prisma.task.update({
      where: { id },
      data: updates,
    })
  }

  async deleteTask(id: string): Promise<boolean> {
    await prisma.task.delete({ where: { id } })
    return true
  }

  // Task Step Methods
  async getTaskSteps(taskId: string): Promise<TaskStep[]> {
    return prisma.taskStep.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createTaskStep(insertStep: InsertTaskStep): Promise<TaskStep> {
    return prisma.taskStep.create({
      data: insertStep,
    })
  }

  async updateTaskStep(id: string, updates: UpdateTaskStep): Promise<TaskStep | null> {
    return prisma.taskStep.update({
      where: { id },
      data: updates,
    })
  }

  async getLatestTaskStep(taskId: string): Promise<TaskStep | null> {
    return prisma.taskStep.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    })
  }

  // User Memories
  async getUserMemories(userId: string, options?: { type?: string }): Promise<UserMemory[]> {
    const where: any = { userId }
    if (options?.type) {
      where.type = options.type
    }
    return prisma.userMemory.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async getUserMemoryById(id: string): Promise<UserMemory | null> {
    return prisma.userMemory.findUnique({ where: { id } })
  }

  async createUserMemory(memory: InsertUserMemory): Promise<UserMemory> {
    const created = await prisma.userMemory.create({ data: memory })

    // Generate embedding asynchronously (non-blocking)
    this.generateUserMemoryEmbedding(created.id).catch((error) => {
      console.error(`[Storage] Background embedding generation failed for ${created.id}:`, error)
    })

    return created
  }

  async updateUserMemory(id: string, updates: Partial<UserMemory>): Promise<UserMemory | null> {
    const updated = await prisma.userMemory.update({
      where: { id },
      data: updates,
    })

    // Regenerate embedding if content changed
    if (updates.value || updates.description) {
      this.generateUserMemoryEmbedding(id).catch((error) => {
        console.error(`[Storage] Background embedding regeneration failed for ${id}:`, error)
      })
    }

    return updated
  }

  async deleteUserMemory(id: string): Promise<boolean> {
    try {
      await prisma.userMemory.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }

  async generateUserMemoryEmbedding(id: string): Promise<UserMemory | null> {
    const memory = await prisma.userMemory.findUnique({ where: { id } })
    if (!memory) return null

    try {
      // Combine type, value, and description for embedding
      const embeddingText = `[${memory.type.toUpperCase()}] ${memory.value}${
        memory.description ? '\n\n' + memory.description : ''
      }`

      const embeddingVector = await generateEmbedding(embeddingText)
      const embeddingStr = `[${embeddingVector.join(',')}]`

      // Use raw SQL to update vector field (Unsupported type in Prisma)
      await prisma.$executeRaw`
        UPDATE androiduse.user_memories
        SET
          embedding = ${embeddingStr}::vector,
          embedding_model = ${EMBEDDING_CONFIG.model},
          embedding_version = ${EMBEDDING_CONFIG.version}
        WHERE id = ${id}
      `

      console.log(`[Storage] Generated embedding for memory: ${id}`)

      // Fetch updated record
      return prisma.userMemory.findUnique({ where: { id } })
    } catch (error) {
      console.error(`[Storage] Failed to generate embedding for ${id}:`, error)
      return memory
    }
  }

  async searchUserMemories(
    userId: string,
    query: string,
    options?: { type?: string; limit?: number }
  ): Promise<UserMemorySearchResult[]> {
    const limit = options?.limit || 10

    // If no query, just return filtered memories
    if (!query || query.trim().length === 0) {
      const memories = await this.getUserMemories(userId, { type: options?.type })
      return memories.slice(0, limit).map(m => ({ ...m, relevanceScore: 1 }))
    }

    try {
      const queryEmbedding = await generateEmbeddingWithCache(query)
      const embeddingStr = `[${queryEmbedding.join(',')}]`

      const typeFilter = options?.type ? `AND m.type = $2` : ''
      const params = options?.type ? [userId, options.type, query, embeddingStr, limit] : [userId, query, embeddingStr, limit]
      const paramOffset = options?.type ? 3 : 2

      const results = await prisma.$queryRawUnsafe<any[]>(`
        WITH
        keyword_results AS (
          SELECT
            m.id,
            ts_rank(
              to_tsvector('english', m.value || ' ' || COALESCE(m.description, '')),
              plainto_tsquery('english', $${paramOffset})
            ) as keyword_score
          FROM "androiduse"."user_memories" m
          WHERE m.user_id = $1
            ${typeFilter}
            AND to_tsvector('english', m.value || ' ' || COALESCE(m.description, '')) @@ plainto_tsquery('english', $${paramOffset})
        ),
        vector_results AS (
          SELECT
            m.id,
            1 - (m.embedding <=> $${paramOffset + 1}::vector) as vector_score
          FROM "androiduse"."user_memories" m
          WHERE m.user_id = $1
            ${typeFilter}
            AND m.embedding IS NOT NULL
        ),
        combined_scores AS (
          SELECT
            m.id,
            COALESCE(kr.keyword_score, 0) * 0.6 + COALESCE(vr.vector_score, 0) * 0.4 as relevance_score,
            COALESCE(kr.keyword_score, 0) as keyword_score,
            vr.vector_score,
            (m.embedding IS NOT NULL) as has_embedding
          FROM "androiduse"."user_memories" m
          LEFT JOIN keyword_results kr ON m.id = kr.id
          LEFT JOIN vector_results vr ON m.id = vr.id
          WHERE m.user_id = $1
            ${typeFilter}
            AND (kr.keyword_score > 0 OR vr.vector_score IS NOT NULL)
        )
        SELECT
          m.*,
          cs.relevance_score,
          cs.keyword_score,
          cs.vector_score,
          cs.has_embedding
        FROM combined_scores cs
        JOIN "androiduse"."user_memories" m ON m.id = cs.id
        ORDER BY cs.relevance_score DESC
        LIMIT $${paramOffset + 2}
      `, ...params)

      return results.map(r => ({
        ...r,
        relevanceScore: r.relevance_score,
        searchMetadata: {
          keywordScore: r.keyword_score,
          vectorScore: r.vector_score,
          hasEmbedding: r.has_embedding,
        },
      }))
    } catch (error) {
      console.error('[Storage] Memory search failed, falling back to simple filter:', error)
      const memories = await this.getUserMemories(userId, { type: options?.type })
      return memories
        .filter(m => m.value.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(m => ({ ...m, relevanceScore: 0.5 }))
    }
  }

  // User Tokens (Password Reset & Email Verification)
  async createPasswordResetToken(data: InsertUserToken): Promise<UserToken> {
    return prisma.userToken.create({ data })
  }

  async getPasswordResetToken(token: string): Promise<UserToken | null> {
    return prisma.userToken.findUnique({
      where: { token },
    })
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<boolean> {
    try {
      await prisma.userToken.update({
        where: { token },
        data: { usedAt: new Date() },
      })
      return true
    } catch {
      return false
    }
  }

  async deleteExpiredPasswordResetTokens(): Promise<number> {
    const result = await prisma.userToken.deleteMany({
      where: {
        type: 'PASSWORD_RESET',
        expiresAt: {
          lt: new Date(),
        },
      },
    })
    return result.count
  }

  async deleteUserPasswordResetTokens(userId: string): Promise<boolean> {
    try {
      await prisma.userToken.deleteMany({
        where: {
          userId,
          type: 'PASSWORD_RESET',
        },
      })
      return true
    } catch {
      return false
    }
  }

  async seedData(): Promise<void> {
    const existingApps = await prisma.app.findFirst()
    if (existingApps) {
      return
    }

    const sampleApps: InsertApp[] = [
      {
        packagePath: 'com.whatsapp',
        name: 'WhatsApp',
        version: '2.24.1',
        iconUrl: null,
        category: 'communication',
      },
      {
        packagePath: 'com.instagram.android',
        name: 'Instagram',
        version: '302.0',
        iconUrl: null,
        category: 'social',
      },
      {
        packagePath: 'com.spotify.music',
        name: 'Spotify',
        version: '8.8.96',
        iconUrl: null,
        category: 'music',
      },
      {
        packagePath: 'com.google.android.gm',
        name: 'Gmail',
        version: '2024.01',
        iconUrl: null,
        category: 'productivity',
      },
      {
        packagePath: 'com.twitter.android',
        name: 'X (Twitter)',
        version: '10.25',
        iconUrl: null,
        category: 'social',
      },
    ]

    const insertedApps = await Promise.all(
      sampleApps.map(app => prisma.app.create({ data: app }))
    )

    const appMap: Record<string, string> = {}
    insertedApps.forEach((app) => {
      appMap[app.packagePath] = app.id
    })

    const sampleSkill: InsertSkill[] = [
      {
        title: 'Send WhatsApp Message',
        description: 'Automate sending text messages to any contact in WhatsApp. Handles contact search, chat opening, and message composition.',
        appId: appMap['com.whatsapp'],
        authorId: null,
        score: 95,
        downloads: 1245,
        featured: true,
      },
      {
        title: 'Post Instagram Story',
        description: 'Automatically capture and post photos or videos to Instagram Stories with customizable stickers and text overlays.',
        appId: appMap['com.instagram.android'],
        authorId: null,
        score: 88,
        downloads: 892,
        featured: true,
      },
      {
        title: 'Play Spotify Playlist',
        description: 'Search and play any playlist, album, or artist on Spotify. Supports shuffle mode and queue management.',
        appId: appMap['com.spotify.music'],
        authorId: null,
        score: 82,
        downloads: 654,
        featured: false,
      },
      {
        title: 'Gmail Email Composer',
        description: 'Compose and send emails through Gmail with support for attachments, CC/BCC, and draft saving.',
        appId: appMap['com.google.android.gm'],
        authorId: null,
        score: 79,
        downloads: 523,
        featured: false,
      },
      {
        title: 'Tweet Scheduler',
        description: 'Schedule and post tweets at optimal times. Includes thread support and engagement analytics.',
        appId: appMap['com.twitter.android'],
        authorId: null,
        score: 75,
        downloads: 412,
        featured: false,
      },
    ]

    await prisma.skill.createMany({ data: sampleSkill })

    // Note: Devices need deviceTypeId, so we'll skip seeding devices for now
    // until device types are properly set up
  }
}

export const storage = new DatabaseStorage()

