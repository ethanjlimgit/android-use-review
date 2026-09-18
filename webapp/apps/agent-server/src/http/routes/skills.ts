/**
 * App knowledge / skill suggestion routes.
 * Equivalent to Python backend's app_card_server.py (port 8001).
 *
 * POST /app-knowledge - get app-specific knowledge for the agent
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../prisma.js';

const appKnowledgeSchema = z.object({
  package_name: z.string(),
  instruction: z.string().optional(),
});

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  // POST /app-knowledge - get skills/knowledge for a specific app package
  app.post('/app-knowledge', async (request, reply) => {
    const body = appKnowledgeSchema.parse(request.body);

    // Find the app by package name
    const appRecord = await prisma.app.findFirst({
      where: { packagePath: body.package_name, enabled: true },
    });

    if (!appRecord) {
      return reply.code(404).send({ app_knowledge: '' });
    }

    // Get skills for this app
    const where: Record<string, unknown> = { appId: appRecord.id };

    // If instruction provided, do keyword search for relevant skills
    if (body.instruction) {
      where.OR = [
        { title: { contains: body.instruction, mode: 'insensitive' } },
        { description: { contains: body.instruction, mode: 'insensitive' } },
      ];
    }

    const skills = await prisma.skill.findMany({
      where: where as Parameters<typeof prisma.skill.findMany>[0],
      orderBy: { score: 'desc' },
      take: body.instruction ? 5 : 20,
    });

    if (skills.length === 0) {
      return { app_knowledge: '' };
    }

    // Format as markdown (same format as Python's app card server)
    const lines = [
      `## ${appRecord.name} - Available Skills\n`,
      ...skills.map(
        (s: (typeof skills)[number], i: number) =>
          `${i + 1}. **${s.title}**: ${s.description}`,
      ),
    ];

    return { app_knowledge: lines.join('\n') };
  });
}
