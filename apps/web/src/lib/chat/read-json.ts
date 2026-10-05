// Reading a JSON request body with a size limit, shared by the chat and CV PDF routes.

/**
 * The body as JSON, read up to `maxBytes`: a larger one is cut off as it arrives (not buffered
 * whole first), and gives "too-large". Unreadable JSON gives "invalid".
 */
export async function readJson(request: Request, maxBytes: number): Promise<{ json: unknown } | "too-large" | "invalid"> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return "too-large";
  if (!request.body) return "invalid";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(value);
  }
  try {
    return { json: JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) };
  } catch {
    return "invalid";
  }
}
