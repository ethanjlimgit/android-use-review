import { NextRequest, NextResponse } from "next/server";
import { storage, prisma, generateEmbeddingWithCache } from "@droiduse/shared-lib/server";
import { apiHandler, requireAuth, validateBody } from "@/lib/api-helpers";
import { insertTaskSchema } from "@droiduse/shared-lib";

/**
 * Validate a stored task-step action for replay.
 *
 * Actions are now stored as device commands: {method, params, type}
 * which is already the format the phone's MemoryReplayExecutor expects.
 *
 * Returns null for actions that can't be replayed.
 */
function toReplayAction(
  stored: Record<string, any>
): { method: string; params: Record<string, any>; type: string } | null {
  // New format: already stored as device commands {method, params, type}
  if (stored.method && stored.params !== undefined) {
    return stored as { method: string; params: Record<string, any>; type: string };
  }

  // Legacy: old executor format {action, ...} — skip, can't reliably replay
  if (stored.action) {
    return null;
  }

  // Legacy: old codeact format {type, args, kwargs} — skip
  if (stored.type && stored.args !== undefined) {
    return null;
  }

  return null;
}

export const GET = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  const searchParams = request.nextUrl.searchParams;
  const similarGoal = searchParams.get('similarGoal');
  const status = searchParams.get('status');
  const limit = searchParams.get('limit');

  // Similarity search mode: find completed tasks with matching embeddings
  if (similarGoal) {
    console.log(`[similarGoal] Searching for: "${similarGoal}" (user: ${session.user.id})`);
    const queryEmbedding = await generateEmbeddingWithCache(similarGoal);
    const embeddingStr = `[${queryEmbedding.join(",")}]`;

    // Find the most similar completed task
    const matches = await prisma.$queryRawUnsafe<Array<{ id: string; goal: string; embedding_model: string; similarity: number }>>(`
      SELECT id, goal, embedding_model as "embedding_model",
             1 - (embedding <=> $1::vector) as similarity
      FROM "androiduse"."tasks"
      WHERE user_id = $2
        AND status = 'COMPLETED'
        AND is_replay = false
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= 0.92
      ORDER BY similarity DESC
      LIMIT 1
    `, embeddingStr, session.user.id);

    if (matches.length === 0) {
      console.log(`[similarGoal] No similar task found`);
      return NextResponse.json([]);
    }

    // Assemble replay_actions from task_steps
    const match = matches[0];
    const steps = await prisma.taskStep.findMany({
      where: { taskId: match.id },
      orderBy: { stepNumber: 'asc' },
      select: { actions: true, stepNumber: true },
    });

    // Flatten stored actions and transform to phone-compatible replay format
    const rawActions = steps
      .filter((s) => s.actions != null)
      .flatMap((s) => Array.isArray(s.actions) ? s.actions as Record<string, any>[] : [s.actions as Record<string, any>]);

    const replayActions = rawActions
      .map(toReplayAction)
      .filter((a): a is NonNullable<typeof a> => a !== null);

    console.log(`[similarGoal] Match: ${match.id} (similarity: ${match.similarity}), ${replayActions.length}/${rawActions.length} actions replayable`);
    console.log(`[similarGoal] Replay actions: ${JSON.stringify(replayActions, null, 2)}`);

    return NextResponse.json([{
      ...match,
      replay_actions: replayActions,
    }]);
  }

  const cursor = searchParams.get('cursor');
  const parsedLimit = limit ? parseInt(limit) : 20;

  const tasks = await storage.getTasks({
    userId: session.user.id,
    status: status || undefined,
    limit: parsedLimit + 1,
    cursor: cursor || undefined,
  });

  let nextCursor: string | null = null;
  if (tasks.length > parsedLimit) {
    tasks.pop();
    nextCursor = tasks[tasks.length - 1].id;
  }

  return NextResponse.json({ tasks, nextCursor });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireAuth(request);

  const taskBody = await validateBody(request, insertTaskSchema.omit({ userId: true }))
  const validatedData = {
    ...taskBody,
    userId: session.user.id,
  }

  const task = await storage.createTask(validatedData);
  return NextResponse.json(task, { status: 201 });
});

