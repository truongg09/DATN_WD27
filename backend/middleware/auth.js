const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-secret-key-change-this-in-production';

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
  optionalAuth
};
