# 数字成都 · 天府三街

可以俯瞰和步行浏览的三维街区网站。独立个人项目，源码位于 https://github.com/Trump-One/digital-chengdu 。

## 已实现

- 天府三街东段约 400 米步行路线，34 个 OpenStreetMap 建筑轮廓。
- 俯瞰旋转缩放、地面键盘或触屏按钮行走、建筑碰撞、视角复位。
- 建筑搜索与定位、资料和数据来源、图层开关、日间与暮色光照。
- 登录后提交资料、实地照片、高度修正、GLB 模型；D1 保存记录，R2 保存文件。
- 共建记录每 30 秒重新读取；高度和模型可以独立预览，作者可以撤回。
- 支持手机布局、键盘操作与减少动态效果偏好。

## 数据准确度与范围

来源为 OpenStreetMap API 在 2026-10-13 下载的区域数据，采用 WGS 84。示范中心为 30.54930 N, 104.0640 E，覆盖天府三街东段周边。

建筑轮廓、道路、已有名称与楼层来自地图。楼层乘以 3.2 米仅为高度估算，缺失高度使用 24 米示范值。福年广场新增独立外观重建，双塔高度参照公开资料暂取约 160 米，标为待实测。其余外墙纹理、窗户、树木和道路铺装为示意；地面是平面，并非实景扫描。少量静态车辆仅用于空间尺度示意，没有天气或现实建筑的实时数据接入，也不具备楼内漫游。

共建记录为未核实提案，不自动改变基础地图。目前没有审核发布工作台或多用户在线人物系统。共建提交和撤回需登录。

## 仓库与试用站点

GitHub 仓库与线上试用站点均已公开。浏览街区无需登录，提交与撤回共建内容需要登录。公开托管无需本机开机。

试用地址：https://digital-chengdu-tianfu.inductive-5550.chatgpt.site

公开源码不包含站点部署身份、本地数据库、用户上传文件或认证凭据。复制代码不会获得线上数据库的访问权限。

## 本地运行

需要 Node.js 22.13 或更高版本。

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tranquil_korath.sql
npm run dev -- --port 5189
```

迁移每个本地数据库只执行一次。预览地址 http://localhost:5189 。本地登录入口使用 starter 的模拟用户，不包含生产登录凭据。线上登录由 Sites 托管身份系统提供。

## 验证

```sh
npx tsc --noEmit
node --test tests/*.test.mjs
node tests/runtime.mjs
```

运行接口验收前需启动本地网站并应用本地数据库迁移。接口验收拒绝非本地地址，写入自己的临时记录并清理。

## 数据与模型替换

- `public/geodata/osm-source.osm` 是原始开放地图快照。
- `scripts/prepare-geodata.py` 将快照转换为 `public/geodata/street.json` 的局部米制坐标。
- 想更新基础数据，先替换同范围合法来源的原始快照，运行转换脚本，更新下载日期、重新构建并检查地图变化。
- 每栋建筑保留稳定 OSM ID。社区记录按该 ID 关联，不写入原始地图文件。
- GLB 模型必须内嵌贴图、无外部资源地址、单个文件不超过 8 MB；照片不超过 5 MB。
- 预览会自动将模型居中并按原建筑范围等比缩放。当前不提供手动朝向、地理配准或高度对齐编辑器；精确替换仍需进一步校准。
- Sites 的 `.openai/hosting.json` 指定 D1 的 DB 与 R2 的 BUCKET。数据也可以通过常规的 HTTP 后端重新实现，不依赖三维引擎供应商的付费瓦片。

## 数据许可

© OpenStreetMap contributors，按 ODbL 提供。页面保留署名和原始数据下载入口。
https://www.openstreetmap.org/copyright

代码与用户贡献独立于原始 OSM 数据；未经贡献者明确授权，不应推断上传照片或模型可在本站之外重新分发。

## 福年广场重建说明

- `lib/landmarks.ts` 是原始 OSM 之外的人工补充层，保留原轮廓、标签和链接。
- `lib/funian.ts` 生成幕墙与街景；`lib/urban-detail.ts` 补充立体门窗、店面进深、长椅、花池与排水格栅，并合并静态几何以减少绘制次数。
- 铺装使用 [Poly Haven concrete_pavers_02](https://polyhaven.com/a/concrete_pavers_02) 的颜色、法线和粗糙度贴图，天空光照使用 [overcast_soil_puresky](https://polyhaven.com/a/overcast_soil_puresky)，均为 CC0，来源与校验值见 `public/materials/sources.json`。它们是通用材质，不是成都现场照片或实时天气；未打包外观参考网站的照片。
- [公开位置与外观参考](https://www.funianob.cn/)提供吉泰路 666 号地址、外观照片以及约 160 米双塔资料。其为第三方资料，不能代替实测。
- 新增入口、内院两个一键步行视角；出生点与内院通路有碰撞检查。
- 楼群对应按位置资料人工匹配，T1/T2 编号未确认，故使用方位名称。幕墙分格、店面、绿化、车辆、路灯及铺装仍为参考照片的程序化重建，不是摄影测量。
