-- Legacy accounts cannot be converted into a single owner without choosing credentials.
-- Refuse populated auth tables rather than silently discard identities or sessions.
CREATE TEMP TABLE `__owner_login_guard` (`auth_rows` integer CHECK (`auth_rows` = 0));
--> statement-breakpoint
INSERT INTO `__owner_login_guard` SELECT
  (SELECT count(*) FROM `user`) + (SELECT count(*) FROM `account`) +
  (SELECT count(*) FROM `session`) + (SELECT count(*) FROM `verification`);
--> statement-breakpoint
DROP TABLE `__owner_login_guard`;
--> statement-breakpoint
ALTER TABLE `session` ADD `token_hash` text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `username` text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `password_hash` text NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY,
	`token_hash` text NOT NULL UNIQUE,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_session`(`id`, `expires_at`, `created_at`, `user_id`) SELECT `id`, `expires_at`, `created_at`, `user_id` FROM `session`;--> statement-breakpoint
DROP TABLE `session`;--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY,
	`username` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`(`id`, `created_at`, `updated_at`) SELECT `id`, `created_at`, `updated_at` FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
DROP TABLE `verification`;