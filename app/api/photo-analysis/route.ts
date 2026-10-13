import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { limitedBody, sameOrigin } from "../../../lib/http";
import {
  AnalysisError,
  analyzeBuildingPhoto,
} from "../../../lib/photo-analysis";
import { validatePhoto } from "../../../lib/validation";
import street from "../../../public/geodata/street.json";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      configured: !!env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_VISION_MODEL || "openai/gpt-4.1-mini",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "请从本站提交" }, { status: 403 });
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "请先登录后使用照片分析" }, { status: 401 });
  if (!env.OPENROUTER_API_KEY)
    return Response.json(
      { error: "网站尚未配置视觉 AI 服务，请联系维护者" },
      { status: 503 },
    );
  if (!env.DB)
    return Response.json({ error: "分析服务存储暂不可用" }, { status: 503 });
  let image: string, context: string;
  try {
    const raw = await limitedBody(request, 3 * 1024 * 1024);
    const data = JSON.parse(new TextDecoder().decode(raw));
    const b = street.buildings.find((b) => b.id === data.buildingId);
    if (!b) throw new Error("请选择示范区内的建筑");
    if (data.consent !== true)
      throw new Error("请确认将框选照片交给 OpenRouter 及其模型服务商分析");
    if (
      typeof data.image !== "string" ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.image)
    )
      throw new Error("请上传 JPG、PNG 或 WebP 照片");
    const [prefix, encoded] = data.image.split(",");
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    validatePhoto(bytes.buffer, prefix.slice(5).split(";")[0]);
    image = data.image;
    context = `用户选择的地图建筑：${b.name}，原始地图估算高度 ${b.height} 米（不能从照片重估总高度）。用户描述：${typeof data.notes === "string" ? data.notes.slice(0, 600) : ""}`;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "无法读取照片" },
      { status: 400 },
    );
  }
  // Atomic budget reservation bounds public-site spend, including failed calls.
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS photo_analysis_usage (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, created_at INTEGER NOT NULL)",
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS photo_usage_time ON photo_analysis_usage(created_at)",
  ).run();
  const now = Date.now(),
    day = now - 86400000;
  const configured = Number(env.PHOTO_DAILY_LIMIT || 20);
  const limit = Number.isFinite(configured)
    ? Math.max(1, Math.min(200, Math.floor(configured)))
    : 20;
  const reserved = await env.DB.prepare(
    `INSERT INTO photo_analysis_usage (id,author_id,created_at) SELECT ?,?,? WHERE
    (SELECT count(*) FROM photo_analysis_usage WHERE created_at>?) < ? AND
    (SELECT count(*) FROM photo_analysis_usage WHERE author_id=? AND created_at>?) < 5 AND
    (SELECT count(*) FROM photo_analysis_usage WHERE author_id=? AND created_at>?) < 2`,
  )
    .bind(
      crypto.randomUUID(),
      user.userId,
      now,
      day,
      limit,
      user.userId,
      day,
      user.userId,
      now - 60000,
    )
    .run();
  if (!reserved.meta.changes)
    return Response.json(
      { error: "已达到分析频率或每日限额，请稍后再试（每人每天 5 次）" },
      { status: 429 },
    );
  try {
    const recipe = await analyzeBuildingPhoto(
      env.OPENROUTER_API_KEY,
      env.OPENROUTER_VISION_MODEL || "openai/gpt-4.1-mini",
      image,
      context,
    );
    return Response.json(
      { recipe, model: env.OPENROUTER_VISION_MODEL || "openai/gpt-4.1-mini" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AnalysisError
            ? e.message
            : "分析超时或网络中断，请稍后重试",
      },
      { status: e instanceof AnalysisError ? e.status : 504 },
    );
  }
}
