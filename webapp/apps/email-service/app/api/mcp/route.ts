import { randomUUID, createHash } from "crypto";
import { prisma } from "@/lib/email-prisma";
import { createServer } from "@/lib/mcp/server";
import { NextJsTransport } from "@/lib/mcp/transport";

interface Session {
  server: ReturnType<typeof createServer>;
  transport: NextJsTransport;
}

const sessions = new Map<string, Session>();

async function resolveProjectId(apiKey: string): Promise<string> {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { enabled: true, expiresAt: true, project: { select: { id: true, enabled: true } } },
  });

  if (!record) throw new Error("Invalid API key");
  if (!record.enabled) throw new Error("API key is disabled");
  if (record.expiresAt && record.expiresAt < new Date()) throw new Error("API key has expired");
  if (!record.project.enabled) throw new Error("Project is disabled");

  return record.project.id;
}

function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some(
      (msg) => typeof msg === "object" && msg !== null && msg.method === "initialize",
    );
  }
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).method === "initialize"
  );
}

export async function POST(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");
  const body = await request.json();

  let session: Session;
  let id: string;

  if (sessionId && sessions.has(sessionId)) {
    session = sessions.get(sessionId)!;
    id = sessionId;
  } else if (!sessionId && isInitializeRequest(body)) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32000, message: "Missing X-API-Key header" }, id: null },
        { status: 401 },
      );
    }

    let projectId: string;
    try {
      projectId = await resolveProjectId(apiKey);
    } catch (err) {
      return Response.json(
        { jsonrpc: "2.0", error: { code: -32000, message: (err as Error).message }, id: null },
        { status: 401 },
      );
    }

    const transport = new NextJsTransport();
    const server = createServer(projectId);
    await server.connect(transport);

    id = randomUUID();
    session = { server, transport };
    sessions.set(id, session);
  } else {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: No valid session" }, id: null },
      { status: 400 },
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((msg: unknown) => session.transport.handleRequest(msg)),
    );
    return Response.json(
      responses.filter((r): r is NonNullable<typeof r> => r !== undefined),
      { headers: { "mcp-session-id": id } },
    );
  }

  const response = await session.transport.handleRequest(body);
  if (response) {
    return Response.json(response, { headers: { "mcp-session-id": id } });
  }
  return new Response(null, { status: 202, headers: { "mcp-session-id": id } });
}

export async function GET() {
  return new Response("SSE not implemented for tools-only server", { status: 405 });
}

export async function DELETE(request: Request) {
  const sessionId = request.headers.get("mcp-session-id");
  if (!sessionId || !sessions.has(sessionId)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Invalid or missing session" }, id: null },
      { status: 400 },
    );
  }

  const session = sessions.get(sessionId)!;
  await session.transport.close();
  sessions.delete(sessionId);
  return new Response(null, { status: 200 });
}
