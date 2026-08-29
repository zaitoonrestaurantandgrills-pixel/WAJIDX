require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

let supabase = null;
let supabaseAdmin = null;

if (supabaseUrl && (supabaseAnonKey || supabaseServiceKey)) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Upload file buffer to Supabase Storage
 * @param {string} bucket - Bucket name (default: 'wajidx-media')
 * @param {string} filePath - Path / filename in bucket
 * @param {Buffer} buffer - File buffer
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL of uploaded asset
 */
async function uploadToStorage(bucket = 'wajidx-media', filePath, buffer, contentType) {
  if (!supabaseAdmin) {
    throw new Error('Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
  }

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

module.exports = {
  supabase,
  supabaseAdmin,
  uploadToStorage,
  isConfigured: () => Boolean(supabaseUrl && (supabaseAnonKey || supabaseServiceKey))
};
