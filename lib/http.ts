export async function limitedBody(request: Request, limit = 10 * 1024 * 1024) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("没有收到提交内容");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("文件超过上传大小限制");
    }
    chunks.push(chunk.value);
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
