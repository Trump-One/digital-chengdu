import { sqliteTable, text, real, index } from "drizzle-orm/sqlite-core";
export const contributions = sqliteTable(
  "contributions",
  {
    id: text("id").primaryKey(),
    buildingId: text("building_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    source: text("source").notNull(),
    height: real("height"),
    assetKey: text("asset_key"),
    assetType: text("asset_type"),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    createdAt: text("created_at").notNull(),
    withdrawnAt: text("withdrawn_at"),
  },
  (t) => [
    index("contributions_created_idx").on(t.createdAt),
    index("contributions_author_idx").on(t.authorId),
  ],
);
