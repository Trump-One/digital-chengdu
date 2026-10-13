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
export const FUNIAN_REFERENCE = "https://www.funianob.cn/";
export const FUNIAN_VIEWS = {
  entrance: { position: [-202, 1.75, -19], target: [-143, 12, -50] },
  courtyard: { position: [-205, 1.75, -92], target: [-140, 17, -92] },
} as const;

export function applyFunianOverlay<T extends { buildings: Building[] }>(
  street: T,
): T {
  const names: Record<string, string> = {
    "way-659519929": "花样年福年广场 · 临街塔楼",
    "way-666567456": "花样年福年广场 · 北侧塔楼",
    "way-666567457": "花样年福年广场 · 公寓楼",
    "way-666567458": "福年广场 · 北侧裙楼",
    "way-666567459": "福年广场 · 沿街商业",
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
