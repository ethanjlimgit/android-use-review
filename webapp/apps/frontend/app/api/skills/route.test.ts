import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from './route'
import { storage } from '@droiduse/shared-lib/server'

// Mocks are already set up in vitest.setup.ts

// Helper to create mock NextRequest
function createMockNextRequest(url: string) {
  const urlObj = new URL(url)
  return {
    nextUrl: {
      searchParams: urlObj.searchParams,
    },
  } as any
}

describe('GET /api/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return skill list without search', async () => {
    const mockSkills = [
      { id: '1', title: 'Test Skill 1', description: 'Description 1', appId: 'app1' },
      { id: '2', title: 'Test Skill 2', description: 'Description 2', appId: 'app2' },
    ]

    vi.mocked(storage.getSkills).mockResolvedValue(mockSkills as any)

    const request = createMockNextRequest('http://localhost:3000/api/skills')
    const response = await GET(request)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toEqual(mockSkills)
    expect(storage.getSkills).toHaveBeenCalledWith({})
  })

  it('should use vector search when search query provided', async () => {
    const mockResults = [
      { id: '1', title: 'Gmail Tutorial', description: 'How to use Gmail', appId: 'app1' },
    ]

    vi.mocked(storage.searchSkillsWithEmbeddings).mockResolvedValue(mockResults as any)

    const request = createMockNextRequest('http://localhost:3000/api/skills?search=gmail')
    const response = await GET(request)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data).toEqual(mockResults)
    expect(storage.searchSkillsWithEmbeddings).toHaveBeenCalledWith(
      'gmail',
      { search: 'gmail' }
    )
  })

  it('should handle score range filters', async () => {
    vi.mocked(storage.getSkills).mockResolvedValue([] as any)

    const request = createMockNextRequest(
      'http://localhost:3000/api/skills?scoreMin=3&scoreMax=5'
    )
    const response = await GET(request)

    expect(storage.getSkills).toHaveBeenCalledWith({
      scoreMin: 3,
      scoreMax: 5,
    })
  })

  it('should handle tab filter', async () => {
    vi.mocked(storage.getSkills).mockResolvedValue([] as any)

    const request = createMockNextRequest('http://localhost:3000/api/skills?tab=featured')
    const response = await GET(request)

    expect(storage.getSkills).toHaveBeenCalledWith({
      tab: 'featured',
    })
  })

  it('should return error response on failure', async () => {
    vi.mocked(storage.getSkills).mockRejectedValue(
      new Error('Database connection failed')
    )

    const request = createMockNextRequest('http://localhost:3000/api/skills')
    const response = await GET(request)

    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data).toEqual({ error: 'Failed to fetch skills' })
  })

  it('should not search with empty string', async () => {
    vi.mocked(storage.getSkills).mockResolvedValue([] as any)

    const request = createMockNextRequest('http://localhost:3000/api/skills?search=   ')
    const response = await GET(request)

    expect(storage.getSkills).toHaveBeenCalled()
    expect(storage.searchSkillsWithEmbeddings).not.toHaveBeenCalled()
  })
})
