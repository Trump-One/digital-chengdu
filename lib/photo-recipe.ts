import { z } from "zod";
export const facadeRecipeSchema = z
  .object({
    buildingVisible: z.boolean(),
    style: z.enum(["banded", "grid"]),
    glassColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    stoneColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    trimColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    floorHeight: z.number().min(2.5).max(6),
    podiumHeight: z.number().min(0).max(24),
    windowWidth: z.number().min(1).max(6),
    setback: z.number().min(0).max(6),
    confidence: z.enum(["low", "medium", "high"]),
    observations: z.array(z.string().min(1).max(160)).min(1).max(6),
    uncertainties: z.array(z.string().min(1).max(160)).min(1).max(6),
  })
  .strict();
export type FacadeRecipe = z.infer<typeof facadeRecipeSchema>;
export const recipeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    buildingVisible: { type: "boolean" },
    style: { type: "string", enum: ["banded", "grid"] },
    glassColor: { type: "string" },
    stoneColor: { type: "string" },
    trimColor: { type: "string" },
    floorHeight: { type: "number" },
    podiumHeight: { type: "number" },
    windowWidth: { type: "number" },
    setback: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    observations: { type: "array", items: { type: "string" } },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: [
    "buildingVisible",
    "style",
    "glassColor",
    "stoneColor",
    "trimColor",
    "floorHeight",
    "podiumHeight",
    "windowWidth",
    "setback",
    "confidence",
    "observations",
    "uncertainties",
  ],
};
export const PHOTO_BUILDING_IDS = [
  "way-659519928",
  "way-659519927",
  "way-666608905",
];
export function referenceRecipe(id: string): FacadeRecipe {
  return {
    buildingVisible: true,
    style: id === "way-659519927" ? "banded" : "grid",
    glassColor: "#596c72",
    stoneColor: "#858784",
    trimColor: id === "way-659519927" ? "#a4a496" : "#444e51",
    floorHeight: 3.2,
    podiumHeight: 10.8,
    windowWidth: 1.7,
    setback: id === "way-666608905" ? 0 : 1.2,
    confidence: "medium",
    observations: [
      "用户提供的 T1 对街照片：灰色玻璃、石材裙楼与可开启窗",
      "左侧建筑为横向窗带，右侧建筑以竖向玻璃分格为主",
    ],
    uncertainties: [
      "照片未包含完整楼顶，保留原地图估算高度",
      "非可见立面、裙楼深度和退台尺寸为示意",
    ],
  };
}
