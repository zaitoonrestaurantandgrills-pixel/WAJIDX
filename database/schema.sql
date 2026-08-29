-- WAJIDX Database Schema for devaj database
-- All tables are prefixed with wajidx_ to prevent collisions

CREATE TABLE IF NOT EXISTS `wajidx_admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) DEFAULT 'WAJIDX Admin',
  `role` VARCHAR(50) DEFAULT 'superadmin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `display_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_technologies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `category` VARCHAR(100) DEFAULT 'General',
  `color` VARCHAR(50) DEFAULT '#2674e7',
  `icon` VARCHAR(100) DEFAULT 'code',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_projects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `category_id` INT NULL,
  `short_description` TEXT NOT NULL,
  `full_description` LONGTEXT NULL,
  `problem` LONGTEXT NULL,
  `solution` LONGTEXT NULL,
  `results` LONGTEXT NULL,
  `workflow` LONGTEXT NULL,
  `client_type` VARCHAR(100) DEFAULT 'Enterprise / Custom',
  `year` VARCHAR(20) DEFAULT '2024',
  `status` ENUM('draft', 'published') DEFAULT 'published',
  `is_featured` TINYINT(1) DEFAULT 0,
  `display_order` INT DEFAULT 0,
  `thumbnail_url` VARCHAR(500) NULL,
  `hero_image_url` VARCHAR(500) NULL,
  `live_url` VARCHAR(500) NULL,
  `github_url` VARCHAR(500) NULL,
  `docs_url` VARCHAR(500) NULL,
  `seo_title` VARCHAR(255) NULL,
  `seo_description` TEXT NULL,
  `seo_keywords` VARCHAR(500) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_slug` (`slug`),
  INDEX `idx_status_featured` (`status`, `is_featured`),
  INDEX `idx_category` (`category_id`),
  CONSTRAINT `fk_wajidx_project_category` FOREIGN KEY (`category_id`) REFERENCES `wajidx_categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_project_technologies` (
  `project_id` INT NOT NULL,
  `technology_id` INT NOT NULL,
  PRIMARY KEY (`project_id`, `technology_id`),
  CONSTRAINT `fk_wpt_project` FOREIGN KEY (`project_id`) REFERENCES `wajidx_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpt_tech` FOREIGN KEY (`technology_id`) REFERENCES `wajidx_technologies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_project_features` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(100) DEFAULT 'check_circle',
  `display_order` INT DEFAULT 0,
  CONSTRAINT `fk_wpf_project` FOREIGN KEY (`project_id`) REFERENCES `wajidx_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_project_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `image_url` VARCHAR(500) NOT NULL,
  `caption` VARCHAR(255) NULL,
  `alt_text` VARCHAR(255) NULL,
  `display_order` INT DEFAULT 0,
  CONSTRAINT `fk_wpi_project` FOREIGN KEY (`project_id`) REFERENCES `wajidx_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_site_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` LONGTEXT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wajidx_contact_messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(255) NULL,
  `message` LONGTEXT NOT NULL,
  `is_read` TINYINT(1) DEFAULT 0,
  `ip_address` VARCHAR(50) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
