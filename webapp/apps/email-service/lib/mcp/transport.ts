/**
 * A Transport adapter for Next.js route handlers.
 *
 * Next.js App Router uses Web API Request/Response, not Node.js streams.
 * This transport bridges the gap by accepting a JSON-RPC message and
 * returning the server's response via a promise.
 *
 * We avoid importing types from @modelcontextprotocol/sdk here to prevent
 * dual-package resolution issues (the SDK is resolved with different zod versions
 * in email-mcp vs email-service). The runtime interface is duck-typed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JSONRPCMessage = any;

export class NextJsTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  private responseResolvers = new Map<
    string | number,
    (msg: JSONRPCMessage) => void
  >();

  async start() {}

  async send(message: JSONRPCMessage): Promise<void> {
    const id = message?.id;
    if (id !== undefined) {
      const resolve = this.responseResolvers.get(id);
      if (resolve) {
        resolve(message);
        this.responseResolvers.delete(id);
      }
    }
  }

  async close() {
    this.responseResolvers.clear();
    this.onclose?.();
  }

  /**
   * Feed a JSON-RPC request into the MCP server and return its response.
   * For notifications (no `id`), returns undefined.
   */
  handleRequest(message: unknown): Promise<JSONRPCMessage> | undefined {
    const msg = message as Record<string, unknown>;
    const id = msg?.id;
    if (id === undefined) {
      this.onmessage?.(message);
      return undefined;
    }
    return new Promise<JSONRPCMessage>((resolve) => {
      this.responseResolvers.set(id as string | number, resolve);
      this.onmessage?.(message);
    });
  }
}
