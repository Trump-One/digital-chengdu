CREATE TABLE `contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`building_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`source` text NOT NULL,
	`height` real,
	`asset_key` text,
	`asset_type` text,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` text NOT NULL,
	`withdrawn_at` text
);
--> statement-breakpoint
CREATE INDEX `contributions_created_idx` ON `contributions` (`created_at`);--> statement-breakpoint
CREATE INDEX `contributions_author_idx` ON `contributions` (`author_id`);