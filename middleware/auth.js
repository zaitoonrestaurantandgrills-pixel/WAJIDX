const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { query } = require('../config/db');
const { supabaseAdmin, isConfigured: isSupabaseConfigured } = require('../config/supabase');

const configuredJwtSecret = String(process.env.JWT_SECRET || '').trim();
if (process.env.NODE_ENV === 'production' && configuredJwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
}
const JWT_SECRET = configuredJwtSecret || crypto.randomBytes(48).toString('hex');
if (!configuredJwtSecret) {
  console.warn('[AUTH WARNING] JWT_SECRET is not set. Using an ephemeral development-only secret.');
}

async function verifyAdmin(req, res, next) {
  try {
    let token = null;

    // Check Authorization Header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    } else if (req.cookies && req.cookies.wajidx_admin_token) {
      token = req.cookies.wajidx_admin_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Authentication token is missing.'
      });
    }

    // 1. Try Supabase Auth Token verification if Supabase is active
    if (isSupabaseConfigured() && supabaseAdmin) {
      try {
        const { data: { user }, error: sbError } = await supabaseAdmin.auth.getUser(token);
        if (user && !sbError) {
          let adminProfile = {
            id: 1,
            username: user.email.split('@')[0],
            email: user.email,
            name: user.user_metadata?.full_name || 'WAJIDX Admin',
            role: 'superadmin'
          };
          try {
            const [rows] = await query('SELECT id, username, email, name, role FROM wajidx_admins WHERE email = ? LIMIT 1', [user.email]);
            if (rows && rows.length > 0) {
              adminProfile = rows[0];
            }
          } catch (e) {}
          req.admin = adminProfile;
          return next();
        }
      } catch (err) {
        // Fall through to JWT verification
      }
    }

    // 2. Fallback to standard JWT verification
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid authentication token.'
      });
    }

    // Verify admin in database with fallback
    let adminRecord = {
      id: decoded.id,
      username: decoded.username || 'admin',
      email: decoded.email || 'admin@wajidx.com',
      name: decoded.name || 'WAJIDX Principal',
      role: decoded.role || 'superadmin'
    };

    try {
      const [rows] = await query('SELECT id, username, email, name, role FROM wajidx_admins WHERE id = ?', [decoded.id]);
      if (rows && rows.length > 0) {
        adminRecord = rows[0];
      }
    } catch (dbErr) {
      // Database offline, use token claims
    }

    req.admin = adminRecord;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Invalid token signature.'
    });
  }
}

module.exports = {
  verifyAdmin,
  JWT_SECRET
};
