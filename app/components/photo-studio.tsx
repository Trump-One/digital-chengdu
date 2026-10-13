"use client";
import { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  LoaderCircle,
  Eye,
  Download,
  Send,
} from "lucide-react";
import type { Building, Contribution } from "../../lib/types";
import { facadeRecipeSchema, type FacadeRecipe } from "../../lib/photo-recipe";
type Crop = { x: number; y: number; w: number; h: number };
export default function PhotoStudio({
  buildings,
  initialId,
  signedIn,
  onPreview,
  onClear,
  onSaved,
}: {
  buildings: Building[];
  initialId: string;
  signedIn: boolean;
  onPreview: (c: Contribution) => void;
  onClear: () => void;
  onSaved: () => Promise<void>;
}) {
  const [target, setTarget] = useState(initialId),
    [photo, setPhoto] = useState(""),
    [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 1, h: 1 });
  const [notes, setNotes] = useState(""),
    [source, setSource] = useState("本人拍摄"),
    [consent, setConsent] = useState(false),
    [rights, setRights] = useState(false);
  const [recipe, setRecipe] = useState<FacadeRecipe | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false),
    [blob, setBlob] = useState<Blob | null>(null),
    [accepted, setAccepted] = useState(false);
  const img = useRef<HTMLImageElement>(null),
    anchor = useRef<{ x: number; y: number } | null>(null),
    urls = useRef<string[]>([]),
    generation = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    fetch("/api/photo-analysis")
      .then((r) => r.json() as Promise<{ configured: boolean }>)
      .then((v) => setConfigured(!!v.configured))
      .catch(() => setError("无法获取分析服务状态，请刷新重试"));
    return () => {
      mounted.current = false;
      generation.current++;
      urls.current.forEach(URL.revokeObjectURL);
    };
  }, []);
  function resetDraft() {
    generation.current++;
    setRecipe(null);
    setBlob(null);
    setAccepted(false);
    setStatus("");
    onClear();
  }
  async function upload(file?: File) {
    if (!file) return;
    resetDraft();
    setError("");
    setPhoto("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    ) {
      setError("请选择 20 MB 以内的 JPG、PNG 或 WebP 照片");
      return;
    }
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    setPhoto(url);
    setCrop({ x: 0, y: 0, w: 1, h: 1 });
  }
  function pointer(e: React.PointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }
  async function analyze() {
    const image = img.current;
    if (!image?.naturalWidth) return;
    const seq = ++generation.current;
    setError("");
    setBusy(true);
    setStatus("正在分析建筑结构…");
    setRecipe(null);
    setBlob(null);
    setAccepted(false);
    onClear();
    try {
      if (crop.w < 0.05 || crop.h < 0.05)
        throw new Error("框选区域太小，请重新框选建筑立面");
      const sw = image.naturalWidth * crop.w,
        sh = image.naturalHeight * crop.h,
        scale = Math.min(1, 1400 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      canvas
        .getContext("2d")!
        .drawImage(
          image,
          image.naturalWidth * crop.x,
          image.naturalHeight * crop.y,
          sw,
          sh,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      const response = await fetch("/api/photo-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId: target,
          image: canvas.toDataURL("image/jpeg", 0.86),
          notes,
          consent,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const result = (await response.json()) as {
        error?: string;
        recipe?: unknown;
      };
      if (!response.ok) throw new Error(result.error || "分析失败");
      if (seq !== generation.current || !mounted.current) return;
      setRecipe(facadeRecipeSchema.parse(result.recipe));
      setStatus("分析完成，请核对特征后生成模型");
    } catch (e) {
      if (seq === generation.current && mounted.current) {
        setError(e instanceof Error ? e.message : "分析失败，请重试");
        setStatus("");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function generate() {
    if (!recipe) return;
    const b = buildings.find((b) => b.id === target)!;
    const seq = ++generation.current;
    setBusy(true);
    setError("");
    setStatus("正在构建 3D 草稿…");
    setAccepted(false);
    try {
      const { photoModelGlb } = await import("../../lib/photo-model");
      const next = await photoModelGlb(b, recipe);
      if (seq !== generation.current || !mounted.current) return;
      setBlob(next);
      const url = URL.createObjectURL(next);
      urls.current.push(url);
      onPreview({
        id: "photo-draft-" + crypto.randomUUID(),
        buildingId: target,
        kind: "model",
        title: "照片建模草稿",
        description: recipe.observations.join("；"),
        source,
        height: null,
        assetUrl: url,
        authorName: "本地草稿",
        createdAt: new Date().toISOString(),
        isMine: true,
      });
      setStatus("草稿已放入街区，拖动场景检查；尚未保存");
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "模型生成失败");
        setStatus("");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function update<K extends keyof FacadeRecipe>(
    key: K,
    value: FacadeRecipe[K],
  ) {
    if (!recipe) return;
    setRecipe({ ...recipe, [key]: value });
    setBlob(null);
    setAccepted(false);
    onClear();
    setStatus("参数已修改，请重新生成预览");
  }
  function download() {
    if (!blob) return;
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    urls.current.push(url);
    a.href = url;
    a.download = target + "-photo-draft.glb";
    a.click();
  }
  async function save() {
    if (!blob || !recipe || !accepted || !rights) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        buildingId: target,
        kind: "model",
        title:
          (buildings.find((b) => b.id === target)?.name || "建筑") +
          " · 照片重建",
        description: (
          "AI 照片辅助重建（待核实）。" +
          recipe.observations.join("；") +
          "。不确定部分：" +
          recipe.uncertainties.join("；")
        ).slice(0, 1450),
        source: source + "；OpenRouter 视觉分析，人工确认的参数化模型",
        rights: "yes",
      }))
        form.set(k, v);
      form.set("file", blob, "photo-model.glb");
      const response = await fetch("/api/contributions", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        error?: string;
        recipe?: unknown;
      };
      if (!response.ok) throw new Error(result.error || "保存失败");
      onClear();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="photo-studio">
      <h2 className="panel-heading">从照片补全建筑</h2>
      <p className="description">
        选建筑、框选立面，让 AI 分析可见结构，再由你核对模型。
      </p>
      <div className="contribution-form">
        <label>
          对应地图建筑
          <select
            value={target}
            disabled={busy}
            onChange={(e) => {
              resetDraft();
              setTarget(e.target.value);
            }}
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.name === "未命名建筑" ? " · " + b.id.slice(4) : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="upload-label">
          <ImageIcon size={23} />
          <strong>上传建筑照片</strong>
          <span>JPG / PNG / WebP · 最大 20 MB</span>
          <input
            aria-label="上传建模照片"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </label>
        {photo && (
          <>
            <div
              className="photo-crop"
              onPointerDown={(e) => {
                if (busy) return;
                anchor.current = pointer(e);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!anchor.current || busy) return;
                const p = pointer(e),
                  a = anchor.current;
                setCrop({
                  x: Math.min(a.x, p.x),
                  y: Math.min(a.y, p.y),
                  w: Math.abs(a.x - p.x),
                  h: Math.abs(a.y - p.y),
                });
                setRecipe(null);
                setBlob(null);
                setAccepted(false);
              }}
              onPointerUp={() => {
                if (anchor.current) {
                  anchor.current = null;
                  generation.current++;
                  onClear();
                  setStatus("");
                }
              }}
              onPointerCancel={() => {
                anchor.current = null;
              }}
            >
              <img
                ref={img}
                src={photo}
                alt="待分析建筑照片"
                draggable={false}
                onError={() => setError("照片无法解码，请换一张有效图片")}
              />
              <div
                className="crop-box"
                style={{
                  left: crop.x * 100 + "%",
                  top: crop.y * 100 + "%",
                  width: crop.w * 100 + "%",
                  height: crop.h * 100 + "%",
                }}
              />
            </div>
            <p className="subtle">
              拖动框选一栋楼，避免把树木或邻楼当成目标。下面也可用键盘调整区域。
            </p>
            <details>
              <summary>调整框选范围</summary>
              <div className="photo-fields">
                {(
                  [
                    ["x", "左边界"],
                    ["y", "上边界"],
                    ["w", "宽度"],
                    ["h", "高度"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label} %
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(crop[key] * 100)}
                      disabled={busy}
                      onChange={(e) => {
                        resetDraft();
                        const next = {
                          ...crop,
                          [key]: Number(e.target.value) / 100,
                        };
                        next.x = Math.min(0.95, Math.max(0, next.x));
                        next.y = Math.min(0.95, Math.max(0, next.y));
                        next.w = Math.max(0.01, Math.min(1 - next.x, next.w));
                        next.h = Math.max(0.01, Math.min(1 - next.y, next.h));
                        setCrop(next);
                      }}
                    />
                  </label>
                ))}
              </div>
            </details>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                resetDraft();
                setCrop({ x: 0, y: 0, w: 1, h: 1 });
              }}
            >
              使用整张照片
            </button>
          </>
        )}
        <label>
          位置与补充说明
          <textarea
            rows={2}
            maxLength={600}
            value={notes}
            disabled={busy}
            onChange={(e) => {
              setNotes(e.target.value);
              resetDraft();
            }}
            placeholder="例如：T1 对街，照片右侧的玻璃楼"
          />
        </label>
        {!signedIn && (
          <a
            className="primary full"
            href="/signin-with-chatgpt?return_to=/?studio=photo"
            target="_top"
          >
            登录后使用 AI 分析
          </a>
        )}
        {configured === false && (
          <p className="notice">
            视觉服务尚未配置，暂时无法分析。已选照片仍保留在当前页面。
          </p>
        )}
        <label className="rights">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            同意将框选照片发送给 OpenRouter
            及其模型服务商分析。仅分析时发送压缩图；保存共建时发布生成的模型。
          </span>
        </label>
        <button
          type="button"
          className="primary full"
          disabled={!photo || !signedIn || !configured || !consent || busy}
          onClick={() => void analyze()}
        >
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <ImageIcon size={17} />
          )}
          分析建筑照片
        </button>
        {recipe && (
          <div className="photo-results">
            <h3>照片中看到了什么</h3>
            <ul>
              {recipe.observations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
            <details open>
              <summary>仍需核实</summary>
              <ul>
                {recipe.uncertainties.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </details>
            <p className="subtle">
              建筑总高度与轮廓沿用地图。以下尺寸为 AI
              估算，可修改；背面沿用相同风格。
            </p>
            <label>
              立面风格
              <select
                value={recipe.style}
                disabled={busy}
                onChange={(e) =>
                  update("style", e.target.value as FacadeRecipe["style"])
                }
              >
                <option value="grid">玻璃分格</option>
                <option value="banded">横向窗带</option>
              </select>
            </label>
            <div className="photo-fields">
              {(
                [
                  ["glassColor", "玻璃"],
                  ["stoneColor", "石材"],
                  ["trimColor", "窗框"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="color"
                    value={recipe[key]}
                    disabled={busy}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div className="photo-fields">
              {(
                [
                  ["floorHeight", "层高", 2.5, 6],
                  ["podiumHeight", "裙楼高", 0, 24],
                  ["windowWidth", "窗格宽", 1, 6],
                  ["setback", "四周退台", 0, 6],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key}>
                  {label}（米）
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={0.1}
                    value={recipe[key]}
                    disabled={busy}
                    onChange={(e) =>
                      update(
                        key,
                        Math.max(min, Math.min(max, Number(e.target.value))),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="secondary full"
              disabled={busy}
              onClick={() => void generate()}
            >
              <Eye size={17} />
              生成 / 更新 3D 预览
            </button>
          </div>
        )}
        {blob && (
          <>
            <label className="rights">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>我已在场景中查看，确认采用这个模型草稿</span>
            </label>
            <label>
              照片来源
              <input
                value={source}
                maxLength={350}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <label className="rights">
              <input
                type="checkbox"
                checked={rights}
                onChange={(e) => setRights(e.target.checked)}
              />
              <span>我有权分享照片所生成的模型，并同意公开为共建提案</span>
            </label>
            <button
              className="primary full"
              disabled={
                busy ||
                !accepted ||
                !rights ||
                source.trim().length < 2 ||
                !signedIn
              }
              onClick={() => void save()}
            >
              <Send size={17} />
              确认并保存共建模型
            </button>
            <button className="secondary full" onClick={download}>
              <Download size={17} />
              下载 GLB 模型
            </button>
          </>
        )}
        {status && (
          <p className="notice" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="subtle">
          AI
          分析生成近似结构模型，不是实景扫描。保存后可在共建记录预览或撤回，不会自动覆盖所有人的基础地图。
        </p>
      </div>
    </div>
  );
}
