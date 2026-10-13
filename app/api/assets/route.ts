import { env } from "cloudflare:workers";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !env.DB || !env.BUCKET)
    return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare(
    "SELECT asset_key,asset_type FROM contributions WHERE id=? AND withdrawn_at IS NULL",
  )
    .bind(id)
    .first<{ asset_key: string; asset_type: string }>();
  if (!row?.asset_key) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(row.asset_key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": row.asset_type,
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
