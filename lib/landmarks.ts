import type { Building } from "./types";

// This curated overlay never mutates the downloaded OSM snapshot. Naming and
// massing are matched to the published location/photo references, not a survey.
export const FUNIAN_IDS = [
  "way-659519929",
  "way-666567456",
  "way-666567457",
  "way-666567458",
  "way-666567459",
];
// User annotated the eastern podium beside the street-facing T1 on 2026-10-13.
// Three 5.4 m levels place the fourth-floor deck at an estimated 16.2 m.
export const FUNIAN_TERRACE = {
  buildingId: "way-666567459",
  towerId: "way-659519929",
  podiumHeight: 16.2,
  floorHeight: 16.7,
  points: [
    [-119.43, -67.9],
    [-89.6, -68.1],
    [-89.3, -34.91],
    [-119.1, -34.57],
    [-119.43, -67.9],
  ],
  view: { position: [-59, 48, 11], target: [-108, 17, -52] },
} as const;
export const FUNIAN_REFERENCE = "https://www.funianob.cn/";
export const FUNIAN_VIEWS = {
  entrance: { position: [-202, 1.75, -19], target: [-143, 12, -50] },
  courtyard: { position: [-205, 1.75, -92], target: [-140, 17, -92] },
} as const;

export function applyFunianOverlay<T extends { buildings: Building[] }>(
  street: T,
): T {
  const names: Record<string, string> = {
    "way-659519929": "花样年福年广场 · T1 临街塔楼",
    "way-666567456": "花样年福年广场 · 北侧塔楼",
    "way-666567457": "花样年福年广场 · 公寓楼",
    "way-666567458": "福年广场 · 北侧裙楼",
    "way-666567459": "福年广场 · T1 露台裙楼",
  };
  return {
    ...street,
    buildings: street.buildings.map((b) =>
      names[b.id]
        ? {
            ...b,
            name: names[b.id],
            landmark: "funian",
            referenceUrl: FUNIAN_REFERENCE,
            ...(b.id === FUNIAN_TERRACE.buildingId
              ? {
                  height: FUNIAN_TERRACE.podiumHeight,
                  heightSource: "四楼露台位置由用户指认 · 标高按层高暂估",
                }
              : {}),
            // Keep raw levels in tags for comparison. Sources describe 160 m towers;
            // individual tower IDs/heights are not surveyed and are visibly qualified.
            ...(FUNIAN_IDS.slice(0, 2).includes(b.id)
              ? {
                  height: 160,
                  heightSource: "公开楼盘资料约 160 米 · 待实测",
                  levels: null,
                }
              : {}),
          }
        : b,
    ),
  };
}
