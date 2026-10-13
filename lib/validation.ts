import { z } from "zod";
export const contributionSchema = z
  .object({
    buildingId: z.string().regex(/^way-\d+$/),
    kind: z.enum(["note", "height", "model", "photo"]),
    title: z.string().trim().min(2, "标题至少需要两个字").max(80),
    description: z.string().trim().min(5, "请描述你发现的情况").max(1500),
    source: z.string().trim().min(2, "请说明资料来源").max(500),
    height: z.coerce.number().min(2).max(300).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "height" && v.height === undefined)
      ctx.addIssue({
        code: "custom",
        path: ["height"],
        message: "请填写建筑高度",
      });
  });
export function validateGlb(bytes: ArrayBuffer) {
  if (bytes.byteLength < 20 || bytes.byteLength > 8 * 1024 * 1024)
    throw new Error("模型需为 8 MB 以内的 GLB 文件");
  const view = new DataView(bytes);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  )
    throw new Error("GLB 文件格式无效");
  const length = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    length > 1024 * 1024 ||
    20 + length > bytes.byteLength
  )
    throw new Error("模型结构无效或过于复杂");
  const gltf = JSON.parse(
    new TextDecoder().decode(new Uint8Array(bytes, 20, length)),
  );
  if (gltf.asset?.version !== "2.0") throw new Error("只支持 glTF 2.0 模型");
  if (gltf.extensionsRequired?.length)
    throw new Error("请导出不依赖额外扩展的标准 GLB");
  if (
    [...(gltf.buffers || []), ...(gltf.images || [])].some(
      (v: { uri?: string }) => v.uri,
    )
  )
    throw new Error("请将贴图和资源嵌入 GLB，不能引用外部文件");
  if (
    (gltf.nodes?.length || 0) > 500 ||
    (gltf.materials?.length || 0) > 100 ||
    (gltf.images?.length || 0) > 16
  )
    throw new Error("模型过于复杂，请先简化");
  if (
    (gltf.accessors || []).reduce(
      (n: number, a: { count: number }) => n + (a.count || 0),
      0,
    ) > 1500000
  )
    throw new Error("模型面数过高，请先简化");
  if (
    (gltf.buffers || []).some(
      (v: { byteLength: number }) => v.byteLength > 8 * 1024 * 1024,
    )
  )
    throw new Error("模型资源过大");
  return true;
}
export function validatePhoto(bytes: ArrayBuffer, type: string) {
  const b = new Uint8Array(bytes);
  if (b.length > 5 * 1024 * 1024 || b.length < 12)
    throw new Error("照片需小于 5 MB");
  const jpg =
    type === "image/jpeg" && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const png =
    type === "image/png" &&
    b[0] === 137 &&
    b[1] === 80 &&
    b[2] === 78 &&
    b[3] === 71;
  const webp =
    type === "image/webp" &&
    new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(b.slice(8, 12)) === "WEBP";
  if (!jpg && !png && !webp) throw new Error("请使用 JPG、PNG 或 WebP 照片");
}
