"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Search,
  Plus,
  Minus,
  Compass,
  Layers,
  Users,
  Info,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  MapPin,
  Footprints,
  View,
  RotateCcw,
  Maximize,
  Sun,
  Moon,
  X,
  Check,
  ChevronRight,
  Send,
  Upload,
  Box,
  Image as ImageIcon,
  FileText,
  Ruler,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Navigation,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import rawStreet from "../../public/geodata/street.json";
import type {
  Street,
  Building,
  Contribution,
  SceneOptions,
  SceneApi,
} from "../../lib/types";
const street = rawStreet as Street;
const defaultOptions: SceneOptions = {
  mode: "overview",
  trees: true,
  labels: true,
  buildings: true,
  night: false,
  community: true,
  selected: null,
  preview: null,
};
const named = street.buildings.filter((b) => b.name !== "未命名建筑");
const kindNames: Record<string, string> = {
  note: "资料补充",
  height: "高度修正",
  model: "建筑模型",
  photo: "实地照片",
};
function MiniMap({
  position,
  onReset,
}: {
  position: { x: number; z: number };
  onReset: () => void;
}) {
  return (
    <button
      className="minimap"
      onClick={onReset}
      aria-label="小地图，点击返回起点"
    >
      <svg viewBox="-325 -255 650 510" aria-hidden="true">
        <rect x="-325" y="-255" width="650" height="510" fill="#e7e9e0" />
        {street.greens.map((g, i) => (
          <polygon
            key={"g" + i}
            points={g.points.map((p) => p.join(",")).join(" ")}
            fill="#becab3"
          />
        ))}
        {street.roads.map((r, i) => (
          <polyline
            key={i}
            points={r.points.map((p) => p.join(",")).join(" ")}
            stroke="#fcfcf6"
            strokeWidth={r.width + 3}
            fill="none"
          />
        ))}
        {street.buildings.map((b) => (
          <polygon
            key={b.id}
            points={b.points.map((p) => p.join(",")).join(" ")}
            fill="#a0b4ac"
            stroke="#f3f4ef"
            strokeWidth="2"
          />
        ))}
        <polyline
          points={street.route.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#246b59"
          strokeWidth="5"
        />
        <circle
          cx={Math.max(-300, Math.min(300, position.x))}
          cy={Math.max(-230, Math.min(230, position.z))}
          r="12"
          fill="#246b59"
          stroke="#fff"
          strokeWidth="5"
        />
      </svg>
      <span>
        <Navigation size={11} />
        天府三街<span>北 ↑</span>
      </span>
    </button>
  );
}
export default function CityApp() {
  const host = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const api = useRef<SceneApi | null>(null);
  const [options, setOptions] = useState(defaultOptions);
  const [ready, setReady] = useState(false);
  const [sceneError, setSceneError] = useState("");
  const [panel, setPanel] = useState<
    "explore" | "layers" | "community" | "about" | "building" | "contribute"
  >("explore");
  const [panelOpen, setPanelOpen] = useState(true);
  const [selected, setSelected] = useState<Building | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [feedLoading, setFeedLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState({ x: 0, z: 0 });
  const [formKind, setFormKind] = useState("note");
  const [formTarget, setFormTarget] = useState(street.buildings[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const notify = useCallback((text: string) => setMessage(text), []);
  const choose = useCallback((id: string) => {
    const b = street.buildings.find((b) => b.id === id);
    if (!b) return;
    setSelected(b);
    setOptions((o) => ({ ...o, selected: id }));
    setPanel("building");
    setPanelOpen(true);
    setSearching(false);
    api.current?.focus(id);
  }, []);
  useEffect(() => {
    let cancelled = false;
    import("../../lib/scene")
      .then(({ createScene }) => {
        if (cancelled || !host.current) return;
        try {
          api.current = createScene(host.current, street, choose, notify);
          api.current.setOptions(defaultOptions);
          setReady(true);
        } catch (e) {
          setSceneError(e instanceof Error ? e.message : "无法启动三维场景");
        }
      })
      .catch(() => setSceneError("三维组件加载失败，请刷新重试"));
    return () => {
      cancelled = true;
      api.current?.dispose();
      api.current = null;
    };
  }, [choose, notify]);
  useEffect(() => {
    api.current?.setOptions(options);
  }, [options]);
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [panel, selected]);
  useEffect(() => {
    const timer = setInterval(() => {
      const p = api.current?.position();
      if (p) setPosition({ x: p.x, z: p.z });
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/contributions", { cache: "no-store" });
      const body = (await response.json()) as {
        error?: string;
        contributions: Contribution[];
        signedIn: boolean;
      };
      if (!response.ok) throw new Error(body.error || "共建记录加载失败");
      setContributions(body.contributions);
      setOptions((o) =>
        o.preview && !body.contributions.some((c) => c.id === o.preview?.id)
          ? { ...o, preview: null }
          : o,
      );
      setSignedIn(body.signedIn);
      setFeedError("");
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : "网络暂不可用");
    } finally {
      setFeedLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  function openPanel(next: typeof panel) {
    setPanel(next);
    setPanelOpen(true);
  }
  function contribute(b?: Building) {
    setFormTarget(b?.id || selected?.id || street.buildings[0].id);
    setFormError("");
    openPanel("contribute");
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!signedIn) return;
    setSubmitting(true);
    setFormError("");
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        error?: string;
        contributions: Contribution[];
        signedIn: boolean;
      };
      if (!response.ok) throw new Error(body.error || "提交失败");
      await refresh();
      setPanel("community");
      notify("已保存到云端，提案仍待核实");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }
  async function withdraw(c: Contribution) {
    try {
      const response = await fetch("/api/contributions?id=" + c.id, {
        method: "DELETE",
      });
      const body = (await response.json()) as {
        error?: string;
        contributions: Contribution[];
        signedIn: boolean;
      };
      if (!response.ok) throw new Error(body.error);
      if (options.preview?.id === c.id)
        setOptions((o) => ({ ...o, preview: null }));
      await refresh();
      notify("提案已撤回，原始地图未改变");
    } catch (e) {
      notify(e instanceof Error ? e.message : "撤回失败");
    }
  }
  const filtered = street.buildings
    .filter((b) => (b.name + b.id).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  const proposalForBuilding = contributions.filter(
    (c) => c.buildingId === selected?.id,
  );
  const nav = [
    { id: "explore", icon: Compass, label: "探索街区" },
    { id: "layers", icon: Layers, label: "图层" },
    { id: "community", icon: Users, label: "共建记录" },
    { id: "about", icon: Info, label: "数据说明" },
  ] as const;
  return (
    <main className={"city-app" + (options.night ? " evening" : "")}>
      <div className="scene" ref={host} />
      {!ready && !sceneError && (
        <div className="scene-loading">
          <LoaderCircle className="spin" />
          <strong>正在铺开天府三街</strong>
          <span>加载真实建筑轮廓与道路</span>
        </div>
      )}
      {sceneError && (
        <div className="scene-loading error">
          <Info />
          <strong>三维场景暂时无法打开</strong>
          <span>{sceneError}</span>
          <p>请使用支持 WebGL 的浏览器，并开启硬件加速。</p>
          <button onClick={() => location.reload()}>重新加载</button>
        </div>
      )}
      <header className="topbar">
        <a className="brand" href="/" aria-label="数字成都首页">
          <span className="brand-mark">
            <Building2 size={25} />
          </span>
          <span>
            数字成都<small>一起，让城市更完整</small>
          </span>
        </a>
        <div className="search">
          <Search size={17} />
          <input
            aria-label="搜索建筑或街道"
            placeholder="搜索天府三街的建筑"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearching(true);
            }}
            onFocus={() => setSearching(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearching(false);
              if (e.key === "Enter") {
                if (query.includes("天府三街")) {
                  api.current?.reset();
                  setSearching(false);
                } else if (filtered[0]) choose(filtered[0].id);
              }
            }}
          />
          <kbd>↵</kbd>
          {searching && (
            <div className="search-results">
              <button
                onClick={() => {
                  api.current?.reset();
                  setSearching(false);
                  openPanel("explore");
                }}
              >
                <MapPin size={16} />
                <span>
                  天府三街<small>当前示范街区</small>
                </span>
              </button>
              {filtered.map((b) => (
                <button key={b.id} onClick={() => choose(b.id)}>
                  <Building2 size={16} />
                  <span>
                    {b.name}
                    <small>{b.id}</small>
                  </span>
                </button>
              ))}
              {!filtered.length && !query.includes("天府三街") && (
                <p>示范区内暂未找到这栋建筑</p>
              )}
              <button
                className="search-close"
                onClick={() => setSearching(false)}
              >
                收起搜索
              </button>
            </div>
          )}
        </div>
        <div className="header-right">
          <span className="pilot-tag">
            <span />
            天府三街示范区
          </span>
          <button className="primary" onClick={() => contribute()}>
            <Plus size={17} />
            <span>参与共建</span>
          </button>
        </div>
      </header>
      <nav className="rail" aria-label="主要导航">
        {nav.map((n) => (
          <button
            key={n.id}
            className={panel === n.id && panelOpen ? "active" : ""}
            aria-label={n.label}
            title={n.label}
            onClick={() => openPanel(n.id)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
        <div className="rail-bottom">
          <span>
            成<br />都
          </span>
        </div>
      </nav>
      <button
        className="panel-toggle icon-btn"
        aria-label={panelOpen ? "收起侧栏" : "展开侧栏"}
        onClick={() => setPanelOpen(!panelOpen)}
      >
        {panelOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
      </button>
      <aside
        ref={panelRef}
        inert={!panelOpen}
        className={"side-panel" + (panelOpen ? " open" : "")}
        aria-label="街区资料"
      >
        {panel === "explore" && (
          <>
            <div className="breadcrumbs">
              四川
              <ChevronRight size={12} />
              成都
              <ChevronRight size={12} />
              高新区
            </div>
            <h1>
              天府三街<span>从这一条街，走进成都。</span>
            </h1>
            <p className="intro">
              沿街走走，认识一栋建筑，
              <br />
              也为这座城市留下你的发现。
            </p>
            <div className="street-stat">
              <span>
                <b>
                  400<small>米</small>
                </b>
                示范步行路线
              </span>
              <span>
                <b>
                  {street.buildings.length}
                  <small>栋</small>
                </b>
                已载入建筑轮廓
              </span>
            </div>
            <button
              className="start-walk primary"
              onClick={() => {
                setOptions((o) => ({ ...o, mode: "walk" }));
                setPanelOpen(false);
              }}
            >
              <Footprints size={19} />
              开始街头漫游
              <ArrowRight size={18} />
            </button>
            <p className="subtle">地面视角 · 键盘移动 · 拖动环顾</p>
            <div className="panel-divider" />
            <div className="section-title">
              <h2>沿街发现</h2>
              <span>{named.length} 处已命名建筑</span>
            </div>
            <div className="building-list">
              {named.map((b, i) => (
                <button key={b.id} onClick={() => choose(b.id)}>
                  <div className={"building-thumb thumb-" + i}>
                    <Building2 size={28} />
                  </div>
                  <span>
                    <strong>{b.name}</strong>
                    <small>
                      {b.levels
                        ? `${b.levels} 层 · 开放地图标注`
                        : "建筑资料待补充"}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <div className="community-invite">
              <Users size={19} />
              <div>
                <strong>城市的下一笔，由你补上</strong>
                <p>照片、楼名、一处新变化，都有用。</p>
              </div>
            </div>
            <button className="text-button" onClick={() => openPanel("about")}>
              真实轮廓，示意外观
              <Info size={14} />
            </button>
          </>
        )}
        {panel === "building" && selected && (
          <>
            <button
              className="back-button"
              onClick={() => openPanel("explore")}
            >
              <ArrowLeft size={15} />
              返回街区
            </button>
            <div className="detail-symbol">
              <Building2 size={40} />
            </div>
            <h2 className="panel-heading">{selected.name}</h2>
            <p className="description">天府三街示范区内的开放地图建筑</p>
            <dl className="facts">
              <div>
                <dt>建筑轮廓</dt>
                <dd>真实地图数据</dd>
              </div>
              <div>
                <dt>显示高度</dt>
                <dd>{Math.round(selected.height * 10) / 10} 米</dd>
              </div>
              <div>
                <dt>高度依据</dt>
                <dd>{selected.heightSource}</dd>
              </div>
              <div>
                <dt>楼层标注</dt>
                <dd>{selected.levels ? selected.levels + " 层" : "暂缺"}</dd>
              </div>
              <div>
                <dt>外墙与窗户</dt>
                <dd>示意材质，待完善</dd>
              </div>
            </dl>
            <p className="notice">
              轮廓来自开放街图；外墙、树木与道路铺装为示意。楼层估算使用每层 3.2
              米，不代表实测高度。
            </p>
            <button
              className="primary full"
              onClick={() => contribute(selected)}
            >
              <Plus size={17} />
              完善这栋建筑
            </button>
            <button
              className="secondary full"
              onClick={() => api.current?.focus(selected.id)}
            >
              <View size={16} />
              定位建筑
            </button>
            <a
              className="source-link"
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              查看原始地图记录
              <ExternalLink size={13} />
            </a>
            <div className="panel-divider" />
            <h3>关于这里的共建提案</h3>
            {proposalForBuilding.length ? (
              proposalForBuilding.map((c) => (
                <div className="compact-proposal" key={c.id}>
                  <strong>{c.title}</strong>
                  <p>{c.description}</p>
                  <small>{kindNames[c.kind]} · 待核实</small>
                </div>
              ))
            ) : (
              <p className="empty-copy">
                这里还没有提案。成为第一个补充资料的人。
              </p>
            )}
          </>
        )}
        {panel === "layers" && (
          <>
            <h2 className="panel-heading">让城市更清楚</h2>
            <p className="description">自由组合你想看的内容。</p>
            <div className="layer-list">
              {[
                {
                  key: "buildings",
                  title: "建筑模型",
                  detail: "真实轮廓，示意立面",
                  icon: Building2,
                },
                {
                  key: "trees",
                  title: "示意行道树",
                  detail: "用于空间感受，非实测树位",
                  icon: Layers,
                },
                {
                  key: "labels",
                  title: "建筑名称",
                  detail: "仅显示地图中已有名称",
                  icon: MapPin,
                },
                {
                  key: "community",
                  title: "社区模型预览",
                  detail: "显示当前选择的未核实提案",
                  icon: Users,
                },
              ].map((l) => (
                <label key={l.key} className="layer-row">
                  <l.icon size={20} />
                  <span>
                    <strong>{l.title}</strong>
                    <small>{l.detail}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(options[l.key as keyof SceneOptions])}
                    onChange={(e) =>
                      setOptions((o) => ({ ...o, [l.key]: e.target.checked }))
                    }
                  />
                </label>
              ))}
            </div>
            <h3>场景光照</h3>
            <div className="segmented">
              <button
                className={!options.night ? "selected" : ""}
                onClick={() => setOptions((o) => ({ ...o, night: false }))}
              >
                <Sun size={16} />
                日间
              </button>
              <button
                className={options.night ? "selected" : ""}
                onClick={() => setOptions((o) => ({ ...o, night: true }))}
              >
                <Moon size={16} />
                暮色
              </button>
            </div>
            <p className="subtle">光照用于浏览体验，不是实时天气。</p>
            <div className="panel-divider" />
            <h3>可替换的数据底座</h3>
            <p className="description">
              原始轮廓与社区内容分别保存。上传更精细的模型后，可以预览替换效果，原始建筑仍保留。
            </p>
            <button className="text-button" onClick={() => openPanel("about")}>
              了解数据来源
              <ArrowRight size={14} />
            </button>
          </>
        )}
        {panel === "community" && (
          <>
            <h2 className="panel-heading">一起建成都</h2>
            <p className="description">
              每一次发现，都让街区更完整。
              <br />
              提案保存在云端，每 30 秒同步。
            </p>
            <button className="primary full" onClick={() => contribute()}>
              <Plus size={17} />
              提交一份贡献
            </button>
            {feedLoading ? (
              <p className="empty-copy">正在加载共建记录…</p>
            ) : feedError ? (
              <div className="notice error-text">
                {feedError}
                <button className="text-button" onClick={() => void refresh()}>
                  重新加载
                </button>
              </div>
            ) : contributions.length === 0 ? (
              <div className="empty-state">
                <Users size={35} />
                <h3>第一笔，等你来写</h3>
                <p>
                  补充一张实地照片，或告诉我们
                  <br />
                  这栋建筑有什么变化。
                </p>
                <span>当前还没有共建提案</span>
              </div>
            ) : (
              <div className="proposal-list">
                {contributions.map((c) => (
                  <article key={c.id}>
                    <div className="proposal-meta">
                      <span>{kindNames[c.kind]}</span>
                      <span>待核实</span>
                    </div>
                    <h3>{c.title}</h3>
                    <button
                      className="inline-target"
                      onClick={() => choose(c.buildingId)}
                    >
                      {
                        street.buildings.find((b) => b.id === c.buildingId)
                          ?.name
                      }
                      <ArrowUpRight size={12} />
                    </button>
                    <p>{c.description}</p>
                    {c.kind === "photo" && c.assetUrl && (
                      <a href={c.assetUrl} target="_blank" rel="noreferrer">
                        <img
                          className="contribution-photo"
                          src={c.assetUrl}
                          alt={c.title}
                          loading="lazy"
                        />
                      </a>
                    )}
                    <small className="proposal-source">来源：{c.source}</small>
                    <div className="proposal-footer">
                      <span>
                        {c.authorName} ·{" "}
                        {new Intl.DateTimeFormat("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          timeZone: "Asia/Shanghai",
                        }).format(new Date(c.createdAt))}
                      </span>
                      {c.isMine && (
                        <button onClick={() => void withdraw(c)}>撤回</button>
                      )}
                    </div>
                    {["model", "height"].includes(c.kind) && (
                      <button
                        className="secondary full"
                        onClick={() => {
                          setOptions((o) => ({
                            ...o,
                            preview: o.preview?.id === c.id ? null : c,
                            community: true,
                            selected: c.buildingId,
                          }));
                          api.current?.focus(c.buildingId);
                        }}
                      >
                        {options.preview?.id === c.id ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}{" "}
                        {options.preview?.id === c.id
                          ? "结束预览"
                          : "在街区中预览"}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            <p className="notice">
              社区提案尚未核实，不会自动修改基础地图。照片和模型请仅上传你有权分享的内容。
            </p>
          </>
        )}
        {panel === "about" && (
          <>
            <h2 className="panel-heading">每一栋，都有来源</h2>
            <p className="description">
              清楚区分真实记录、估算和示意，才能共同建立可信的数字城市。
            </p>
            <dl className="facts">
              <div>
                <dt>示范区域</dt>
                <dd>天府三街东段</dd>
              </div>
              <div>
                <dt>数据下载日期</dt>
                <dd>{street.fetchedDate}</dd>
              </div>
              <div>
                <dt>建筑轮廓</dt>
                <dd>{street.buildings.length} 栋</dd>
              </div>
              <div>
                <dt>坐标基准</dt>
                <dd>WGS 84</dd>
              </div>
            </dl>
            <h3>已经真实对应</h3>
            <p className="description">
              道路走向、建筑轮廓、地图已有的名称与楼层数来自
              OpenStreetMap。数据可能有缺漏，现场情况以实地为准。
            </p>
            <h3>仍需要大家完善</h3>
            <p className="description">
              外墙与窗户、树木位置、道路铺装为示意效果；地面暂按平面展示。没有楼层或高度记录的建筑使用
              24 米示范高度。
            </p>
            <h3>更新与替换</h3>
            <p className="description">
              这是下载日期对应的数据快照，不是实时实景。社区贡献持续保存在独立图层，可预览新的高度和
              GLB 模型，也可撤回自己的提案。
            </p>
            <div className="source-actions">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                © OpenStreetMap contributors · ODbL
                <ExternalLink size={13} />
              </a>
              <a href="/geodata/street.json" download>
                <Download size={14} />
                下载街区数据
              </a>
              <a href="/geodata/osm-source.osm" download>
                <Download size={14} />
                下载原始开放地图
              </a>
            </div>
            <p className="notice">
              当前为私有试用站点。共建功能已具备云端存储；开放给更多人前，需要调整站点访问权限。
            </p>
          </>
        )}
        {panel === "contribute" && (
          <>
            <button
              className="back-button"
              onClick={() => openPanel("community")}
            >
              <ArrowLeft size={15} />
              返回共建记录
            </button>
            <h2 className="panel-heading">添上你知道的成都</h2>
            <p className="description">不用会建模，一条准确的信息就有用。</p>
            {!signedIn ? (
              <div className="sign-in-box">
                <Users size={30} />
                <h3>登录后，把发现留下来</h3>
                <p>你的贡献会与账号关联，并支持撤回。</p>
                <a
                  className="primary full"
                  href="/signin-with-chatgpt?return_to=/"
                  target="_top"
                >
                  登录后参与共建
                  <ArrowRight size={16} />
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="contribution-form">
                <label>
                  对应建筑
                  <select
                    name="buildingId"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                  >
                    {street.buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                        {b.name === "未命名建筑" ? " · " + b.id.slice(4) : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend>你想补充什么？</legend>
                  <div className="kind-picker">
                    {[
                      { kind: "note", icon: FileText },
                      { kind: "photo", icon: ImageIcon },
                      { kind: "height", icon: Ruler },
                      { kind: "model", icon: Box },
                    ].map((k) => (
                      <button
                        type="button"
                        key={k.kind}
                        className={formKind === k.kind ? "selected" : ""}
                        onClick={() => setFormKind(k.kind)}
                      >
                        <k.icon size={18} />
                        {kindNames[k.kind]}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="kind" value={formKind} />
                </fieldset>
                <label>
                  标题
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="例如：补充建筑入口名称"
                  />
                </label>
                <label>
                  详细说明
                  <textarea
                    name="description"
                    required
                    minLength={5}
                    maxLength={1500}
                    rows={3}
                    placeholder="你观察到了什么？具体在哪个位置？"
                  />
                </label>
                {formKind === "height" && (
                  <label>
                    建议高度（米）
                    <input
                      type="number"
                      name="height"
                      required
                      min={2}
                      max={300}
                      step="0.1"
                      placeholder="请输入测量或资料中的高度"
                    />
                  </label>
                )}
                {["photo", "model"].includes(formKind) && (
                  <label className="upload-label">
                    <Upload size={19} />
                    <strong>
                      {formKind === "model" ? "上传 GLB 模型" : "上传实地照片"}
                    </strong>
                    <span>
                      {formKind === "model"
                        ? "不超过 8 MB，贴图须嵌入文件"
                        : "JPG / PNG / WebP，不超过 5 MB"}
                    </span>
                    <input
                      key={formKind}
                      name="file"
                      type="file"
                      required
                      accept={
                        formKind === "model"
                          ? ".glb"
                          : "image/jpeg,image/png,image/webp"
                      }
                    />
                  </label>
                )}
                <label>
                  资料来源
                  <input
                    name="source"
                    required
                    minLength={2}
                    maxLength={500}
                    placeholder="例如：本人现场拍摄，2026年10月"
                  />
                </label>
                <label className="rights">
                  <input type="checkbox" name="rights" value="yes" required />
                  <span>
                    我有权分享这些内容，并同意在本站展示。照片不包含不必要的人脸、车牌或个人信息。
                  </span>
                </label>
                {formError && (
                  <p className="error-text" role="alert">
                    {formError}
                  </p>
                )}
                <button
                  className="primary full"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Send size={17} />
                  )}{" "}
                  {submitting ? "正在保存…" : "提交共建提案"}
                </button>
                <p className="subtle">
                  提交后标记为待核实，不直接覆盖基础地图。
                </p>
              </form>
            )}
          </>
        )}
      </aside>
      <div className="scene-caption">
        <span className="caption-dot" />
        开放地图建筑轮廓<span className="caption-separator">/</span>外观为示意
        {options.preview && (
          <button onClick={() => setOptions((o) => ({ ...o, preview: null }))}>
            正在预览未核实提案
            <X size={12} />
          </button>
        )}
      </div>
      <div className="camera-tools">
        <button
          className="icon-btn compass-button"
          aria-label="重置视角"
          title="重置视角"
          onClick={() => api.current?.reset()}
        >
          <RotateCcw size={21} />
          <small>复位</small>
        </button>
        <div className="zoom-group">
          <button
            aria-label="放大"
            onClick={() => api.current?.zoom(1)}
            disabled={options.mode === "walk"}
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="缩小"
            onClick={() => api.current?.zoom(-1)}
            disabled={options.mode === "walk"}
          >
            <Minus size={18} />
          </button>
        </div>
        <button
          className="icon-btn"
          aria-label="切换场景光照"
          onClick={() => setOptions((o) => ({ ...o, night: !o.night }))}
        >
          {options.night ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="icon-btn fullscreen"
          aria-label="全屏浏览"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else
              void document.documentElement
                .requestFullscreen()
                .catch(() => notify("当前浏览器不支持全屏，请使用窗口最大化"));
          }}
        >
          <Maximize size={18} />
        </button>
      </div>
      <div className="location-label">
        <MapPin size={14} />
        <span>成都 · 天府三街</span>
      </div>
      <div className="view-controls">
        <button
          className={options.mode === "overview" ? "selected" : ""}
          onClick={() => setOptions((o) => ({ ...o, mode: "overview" }))}
        >
          <View size={18} />
          俯瞰街区
        </button>
        <button
          className={options.mode === "walk" ? "selected" : ""}
          onClick={() => {
            setOptions((o) => ({ ...o, mode: "walk" }));
            setPanelOpen(false);
          }}
        >
          <Footprints size={18} />
          街头漫游
        </button>
        <span />
        <button aria-label="回到初始位置" onClick={() => api.current?.reset()}>
          <RotateCcw size={17} />
        </button>
      </div>
      {options.mode === "walk" && (
        <div className="walk-guidance">
          <span>
            <kbd>W A S D</kbd> 或方向键移动 · 拖动环顾 · <kbd>Shift</kbd> 快走
          </span>
          <div className="walk-pad">
            {[
              { k: "w", Icon: ArrowUp },
              { k: "a", Icon: ArrowLeft },
              { k: "s", Icon: ArrowDown },
              { k: "d", Icon: ArrowRight },
            ].map(({ k, Icon }) => (
              <button
                key={k}
                aria-label={{ w: "前进", a: "向左", s: "后退", d: "向右" }[k]}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  api.current?.move(k, true);
                }}
                onPointerUp={() => api.current?.move(k, false)}
                onPointerCancel={() => api.current?.move(k, false)}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="map-corner">
        <MiniMap position={position} onReset={() => api.current?.reset()} />
        <div className="scale-bar">
          <span />
          100 米
        </div>
      </div>
      <footer className="attribution">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
        <span>数据下载于 {street.fetchedDate}</span>
      </footer>
      {message && (
        <div className="toast" role="status">
          <Check size={17} />
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </main>
  );
}
