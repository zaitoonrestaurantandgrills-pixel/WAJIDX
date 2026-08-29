const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { verifyAdmin, JWT_SECRET } = require('../middleware/auth');
const { supabase, isConfigured: isSupabaseConfigured } = require('../config/supabase');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username/email and password are required.' });
    }

    const cleanInput = username.trim();

    // 1. Check Supabase Auth if configured and input is an email
    if (isSupabaseConfigured() && supabase && cleanInput.includes('@')) {
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanInput,
          password: password
        });

        if (sbData?.session?.access_token && !sbError) {
          const [admins] = await query(
            'SELECT id, username, email, name, role FROM wajidx_admins WHERE email = ? LIMIT 1',
            [cleanInput]
          );

          const adminUser = admins && admins.length > 0 ? admins[0] : {
            id: 1,
            username: sbData.user.email.split('@')[0],
            email: sbData.user.email,
            name: sbData.user.user_metadata?.full_name || 'WAJIDX Admin',
            role: 'superadmin'
          };

          return res.json({
            success: true,
            message: 'Login successful via Supabase Auth',
            token: sbData.session.access_token,
            admin: adminUser
          });
        }
      } catch (err) {
        // Fall back to database authentication
      }
    }

    // 2. Query admin user from database (PostgreSQL / MySQL)
    const [admins] = await query(
      'SELECT id, username, email, password_hash, name, role FROM wajidx_admins WHERE username = ? OR email = ? LIMIT 1',
      [cleanInput, cleanInput]
    );

    if (!admins || admins.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // Generate JWT (expires in 7 days)
    const token = jwt.sign(
      { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    res.status(500).json({ success: false, error: 'Server error during authentication.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyAdmin, (req, res) => {
  res.json({
    success: true,
    admin: req.admin
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// PUT /api/auth/profile
router.put('/profile', verifyAdmin, async (req, res) => {
  try {
    const { name, email, current_password, new_password } = req.body;
    const adminId = req.admin.id;

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ success: false, error: 'Current password is required to set a new password.' });
      }
      const [rows] = await query('SELECT password_hash FROM wajidx_admins WHERE id = ?', [adminId]);
      const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect.' });
      }
      const newHash = await bcrypt.hash(new_password, 12);
      await query('UPDATE wajidx_admins SET password_hash = ? WHERE id = ?', [newHash, adminId]);
    }

    if (name || email) {
      await query('UPDATE wajidx_admins SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?', [
        name ? name.trim() : null,
        email ? email.trim() : null,
        adminId
      ]);
    }

    const [updated] = await query('SELECT id, username, email, name, role FROM wajidx_admins WHERE id = ?', [adminId]);
    res.json({ success: true, message: 'Profile updated successfully', admin: updated[0] });
  } catch (error) {
    console.error('[PROFILE UPDATE ERROR]', error);
    res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

module.exports = router;
