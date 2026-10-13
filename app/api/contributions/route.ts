import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  contributionSchema,
  validateGlb,
  validatePhoto,
} from "../../../lib/validation";
import { limitedBody, sameOrigin } from "../../../lib/http";
import street from "../../../public/geodata/street.json";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getChatGPTUser();
  if (!env.DB)
    return Response.json(
      { error: "共建存储暂不可用，请稍后再试" },
      { status: 503 },
    );
  const rows = await env.DB.prepare(
    "SELECT * FROM contributions WHERE withdrawn_at IS NULL ORDER BY created_at DESC LIMIT 200",
  ).all();
  return Response.json(
    {
      contributions: rows.results.map((r) => ({
        id: r.id,
        buildingId: r.building_id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        source: r.source,
        height: r.height,
        assetUrl: r.asset_key ? "/api/assets?id=" + r.id : null,
        authorName: r.author_name,
        createdAt: r.created_at,
        isMine: r.author_id === user?.userId,
      })),
      signedIn: !!user,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "请从本站提交" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user)
    return Response.json(
      { error: "请先登录，再提交共建内容" },
      { status: 401 },
    );
  if (!env.DB || !env.BUCKET)
    return Response.json({ error: "共建存储暂不可用" }, { status: 503 });
  const count = await env.DB.prepare(
    "SELECT count(*) AS n FROM contributions WHERE author_id=? AND created_at>?",
  )
    .bind(user.userId, new Date(Date.now() - 3600000).toISOString())
    .first<{ n: number }>();
  if (count && count.n >= 20)
    return Response.json(
      { error: "每小时最多提交 20 条，请稍后再试" },
      { status: 429 },
    );
  let proposal: ReturnType<typeof contributionSchema.parse>;
  let file: File | null = null;
  let bytes: ArrayBuffer | null = null;
  try {
    const body = await limitedBody(request);
    const form = await new Response(body, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const parsed = contributionSchema.safeParse({
      buildingId: form.get("buildingId"),
      kind: form.get("kind"),
      title: form.get("title"),
      description: form.get("description"),
      source: form.get("source"),
      height: form.get("height") || undefined,
    });
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    proposal = parsed.data;
    if (!street.buildings.some((b) => b.id === proposal.buildingId))
      return Response.json({ error: "建筑不在当前示范区内" }, { status: 400 });
    if (form.get("rights") !== "yes")
      return Response.json(
        { error: "请确认你有权分享提交的内容" },
        { status: 400 },
      );
    const upload = form.get("file");
    file = upload instanceof File && upload.size > 0 ? upload : null;
    if (proposal.kind === "model" || proposal.kind === "photo") {
      if (!file) throw new Error("请选择要上传的文件");
      bytes = await file.arrayBuffer();
      if (proposal.kind === "model") validateGlb(bytes);
      else validatePhoto(bytes, file.type);
    } else if (file) throw new Error("请使用照片或模型贡献类型上传文件");
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "无法读取提交内容" },
      { status: 400 },
    );
  }
  const id = crypto.randomUUID();
  const key = bytes ? "contributions/" + id : null;
  const type =
    proposal.kind === "model" ? "model/gltf-binary" : file?.type || null;
  if (key && bytes)
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: type || "application/octet-stream" },
    });
  try {
    await env.DB.prepare(
      "INSERT INTO contributions (id,building_id,kind,title,description,source,height,asset_key,asset_type,author_id,author_name,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        proposal.buildingId,
        proposal.kind,
        proposal.title,
        proposal.description,
        proposal.source,
        proposal.height ?? null,
        key,
        type,
        user.userId,
        user.fullName || "城市共建者",
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    if (key) await env.BUCKET.delete(key);
    throw error;
  }
  return Response.json({ id }, { status: 201 });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "请从本站操作" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!env.DB) return Response.json({ error: "存储暂不可用" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "缺少提案编号" }, { status: 400 });
  const row = await env.DB.prepare(
    "SELECT asset_key FROM contributions WHERE id=? AND author_id=? AND withdrawn_at IS NULL",
  )
    .bind(id, user.userId)
    .first<{ asset_key: string | null }>();
  if (!row)
    return Response.json({ error: "只能撤回自己的有效提案" }, { status: 403 });
  await env.DB.prepare(
    "UPDATE contributions SET withdrawn_at=? WHERE id=? AND author_id=?",
  )
    .bind(new Date().toISOString(), id, user.userId)
    .run();
  if (row.asset_key && env.BUCKET) await env.BUCKET.delete(row.asset_key);
  return Response.json({ ok: true });
}
