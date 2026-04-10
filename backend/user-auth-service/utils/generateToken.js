const jwt = require('jsonwebtoken');

/**
 * Generate access and refresh JWT tokens.
 * @param {Object} payload - { id, name, email, role }
 * @returns {{ accessToken, refreshToken }}
 */
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
  });

  return { accessToken, refreshToken };
};

/**
 * Verify a refresh token and return the decoded payload.
 * @param {string} token
 * @returns decoded payload or throws
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = { generateTokens, verifyRefreshToken };
