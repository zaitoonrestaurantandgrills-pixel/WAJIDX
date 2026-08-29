const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'wajidx_super_secret_jwt_key_2026_precision_minimalism';

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

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Invalid authentication token.'
      });
    }

    // Verify admin in database
    const [rows] = await query('SELECT id, username, email, name, role FROM wajidx_admins WHERE id = ?', [decoded.id]);
    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized. Admin account not found.'
      });
    }

    req.admin = rows[0];
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
