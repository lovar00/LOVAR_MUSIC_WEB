const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin()) {
    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
  next();
};

// Check user type permissions
const checkUserType = (allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({ 
        message: `Access denied. Required user type: ${allowedTypes.join(' or ')}` 
      });
    }
    
    next();
  };
};

// Check if user can download (VIP or ADMIN only)
const canDownload = (req, res, next) => {
  if (!req.user || !req.user.canDownload()) {
    return res.status(403).json({ 
      message: 'Download access requires VIP or ADMIN subscription' 
    });
  }
  next();
};

// Rate limiting for user actions
const userActionLimit = (maxActions = 10, windowMs = 60000) => {
  const userActions = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    
    if (!userActions.has(userId)) {
      userActions.set(userId, []);
    }

    const actions = userActions.get(userId);
    
    // Remove actions outside the window
    const validActions = actions.filter(timestamp => now - timestamp < windowMs);
    
    if (validActions.length >= maxActions) {
      return res.status(429).json({ 
        message: 'Too many actions. Please wait before trying again.' 
      });
    }

    validActions.push(now);
    userActions.set(userId, validActions);
    
    next();
  };
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  auth,
  isAdmin,
  checkUserType,
  canDownload,
  userActionLimit,
  optionalAuth
};