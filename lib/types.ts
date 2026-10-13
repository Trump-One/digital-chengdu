export type Building = {
  landmark?: "funian";
  referenceUrl?: string;
  id: string;
  name: string;
  kind: string;
  points: number[][];
  center: number[];
  height: number;
  heightSource: string;
  levels: number | null;
  sourceUrl: string;
  tags: Record<string, string | undefined>;
};
export type Road = {
  id: string;
  name: string;
  kind: string;
  width: number;
  points: number[][];
};
export type Street = {
  center: { lat: number; lon: number };
  bounds: number[];
  sourceDate: string;
  fetchedDate: string;
  buildings: Building[];
  roads: Road[];
  greens: { points: number[][] }[];
  route: number[][];
  areaLabel: string;
};
export type Contribution = {
  id: string;
  buildingId: string;
  kind: string;
  title: string;
  description: string;
  source: string;
  height: number | null;
  assetUrl: string | null;
  authorName: string;
  createdAt: string;
  isMine: boolean;
};
export type SceneOptions = {
  mode: "overview" | "walk";
  trees: boolean;
  labels: boolean;
  buildings: boolean;
  night: boolean;
  community: boolean;
  selected: string | null;
  preview: Contribution | null;
};
export type SceneApi = {
  setOptions: (options: SceneOptions) => void;
  visit: (view: "entrance" | "courtyard") => void;
  focus: (id: string) => void;
  reset: () => void;
  zoom: (direction: number) => void;
  move: (key: string, pressed: boolean) => void;
  position: () => { x: number; z: number; y: number };
  dispose: () => void;
};
