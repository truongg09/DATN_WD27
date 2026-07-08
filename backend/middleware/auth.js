const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const optionalAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch (_error) {
    req.user = null;
  }

  return next();
};

module.exports = {
  optionalAuth,
  requireAuth: (req, res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
      return next();
    } catch (_error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }
};
