-- ==============================================================================
-- WAJIDX SUPABASE POSTGRESQL SCHEMA (devaj database)
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS wajidx_admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) DEFAULT 'WAJIDX Admin',
  role VARCHAR(50) DEFAULT 'superadmin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS wajidx_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Technologies Table
CREATE TABLE IF NOT EXISTS wajidx_technologies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100) DEFAULT 'General',
  color VARCHAR(50) DEFAULT '#2674e7',
  icon VARCHAR(100) DEFAULT 'code',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Projects Table
CREATE TABLE IF NOT EXISTS wajidx_projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  category_id INT NULL REFERENCES wajidx_categories(id) ON DELETE SET NULL,
  short_description TEXT NOT NULL,
  full_description TEXT NULL,
  problem TEXT NULL,
  solution TEXT NULL,
  results TEXT NULL,
  workflow TEXT NULL,
  client_type VARCHAR(100) DEFAULT 'Enterprise / Custom',
  year VARCHAR(20) DEFAULT '2024',
  status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  is_featured INT DEFAULT 0,
  display_order INT DEFAULT 0,
  thumbnail_url VARCHAR(500) NULL,
  hero_image_url VARCHAR(500) NULL,
  live_url VARCHAR(500) NULL,
  github_url VARCHAR(500) NULL,
  docs_url VARCHAR(500) NULL,
  seo_title VARCHAR(255) NULL,
  seo_description TEXT NULL,
  seo_keywords VARCHAR(500) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wajidx_projects_slug ON wajidx_projects(slug);
CREATE INDEX IF NOT EXISTS idx_wajidx_projects_status ON wajidx_projects(status, is_featured);
CREATE INDEX IF NOT EXISTS idx_wajidx_projects_category ON wajidx_projects(category_id);

-- 6. Project Technologies Join Table
CREATE TABLE IF NOT EXISTS wajidx_project_technologies (
  project_id INT NOT NULL REFERENCES wajidx_projects(id) ON DELETE CASCADE,
  technology_id INT NOT NULL REFERENCES wajidx_technologies(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, technology_id)
);

-- 7. Project Features Table
CREATE TABLE IF NOT EXISTS wajidx_project_features (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES wajidx_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(100) DEFAULT 'check_circle',
  display_order INT DEFAULT 0
);

-- 8. Project Images / Gallery Table
CREATE TABLE IF NOT EXISTS wajidx_project_images (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL REFERENCES wajidx_projects(id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  display_order INT DEFAULT 0
);

-- 9. Site Settings Table (Key-Value)
CREATE TABLE IF NOT EXISTS wajidx_site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Contact Messages Table
CREATE TABLE IF NOT EXISTS wajidx_contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NULL,
  message TEXT NOT NULL,
  is_read INT DEFAULT 0,
  ip_address VARCHAR(50) NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create Supabase Storage Bucket for media uploads (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('wajidx-media', 'wajidx-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow public read of wajidx-media bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for wajidx-media'
  ) THEN
    CREATE POLICY "Public Access for wajidx-media" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'wajidx-media');
  END IF;
END $$;

-- Policy to allow service role & authenticated uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow Uploads for wajidx-media'
  ) THEN
    CREATE POLICY "Allow Uploads for wajidx-media" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'wajidx-media');
  END IF;
END $$;
