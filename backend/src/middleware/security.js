const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Configuration Helmet pour les headers de sécurité HTTP
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 an en secondes
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: {
    policy: 'no-referrer'
  }
});

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit dépassé pour IP: ${req.ip}`);
    res.status(429).json({
      error: 'Trop de requêtes',
      message: 'Vous avez dépassé la limite de requêtes autorisées. Veuillez patienter 15 minutes.'
    });
  }
});

// Rate limiting strict pour les uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // Max 10 uploads par heure
  message: {
    error: 'Limite d\'uploads atteinte',
    retryAfter: '1 hour'
  },
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    console.warn(`⚠️ Upload rate limit dépassé pour IP: ${req.ip}`);
    res.status(429).json({
      error: 'Limite d\'uploads atteinte',
      message: 'Vous avez atteint la limite de 10 uploads par heure. Veuillez patienter.'
    });
  }
});

// Rate limiting pour les downloads
const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 50, // Max 50 downloads par heure
  message: {
    error: 'Limite de téléchargements atteinte',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    console.warn(`⚠️ Download rate limit dépassé pour IP: ${req.ip}`);
    res.status(429).json({
      error: 'Limite de téléchargements atteinte',
      message: 'Vous avez atteint la limite de 50 téléchargements par heure. Veuillez patienter.'
    });
  }
});

// Sanitization des noms de fichiers
const sanitizeFilename = (filename) => {
  if (!filename) return 'unnamed_file';
  
  // Supprimer les caractères dangereux
  let sanitized = filename
    .replace(/[^a-zA-Z0-9._\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ ]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
  
  // Limiter la longueur
  if (sanitized.length > 200) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 200 - ext.length);
    sanitized = name + ext;
  }
  
  return sanitized;
};

// Validation de la taille de fichier
const validateFileSize = (req, res, next) => {
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 52428800; // 50 MB
  
  if (req.file && req.file.size > maxSize) {
    return res.status(413).json({
      error: 'Fichier trop volumineux',
      message: `La taille maximale autorisée est de ${(maxSize / 1024 / 1024).toFixed(0)} MB`,
      maxSize: maxSize
    });
  }
  
  next();
};

// Validation des paramètres d'expiration
const validateExpirationParams = (req, res, next) => {
  const maxDownloads = parseInt(req.body.maxDownloads);
  const expiryHours = parseInt(req.body.expiryHours);
  
  // Validation maxDownloads
  if (maxDownloads !== undefined) {
    if (isNaN(maxDownloads) || maxDownloads < 1 || maxDownloads > 100) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        message: 'maxDownloads doit être un nombre entre 1 et 100'
      });
    }
  }
  
  // Validation expiryHours
  if (expiryHours !== undefined) {
    if (isNaN(expiryHours) || expiryHours < 1 || expiryHours > 168) {
      return res.status(400).json({
        error: 'Paramètre invalide',
        message: 'expiryHours doit être un nombre entre 1 et 168 (7 jours)'
      });
    }
  }
  
  next();
};

// Logger les requêtes (développement uniquement)
const requestLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  }
  next();
};

// Protection CSRF basique
const csrfProtection = (req, res, next) => {
  // Vérifier l'origine pour les requêtes POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ].filter(Boolean);
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`⚠️ Requête CSRF potentielle depuis: ${origin}`);
      return res.status(403).json({
        error: 'Origine non autorisée',
        message: 'Cette requête ne provient pas d\'une origine autorisée'
      });
    }
  }
  
  next();
};

module.exports = {
  helmetConfig,
  globalLimiter,
  uploadLimiter,
  downloadLimiter,
  sanitizeFilename,
  validateFileSize,
  validateExpirationParams,
  requestLogger,
  csrfProtection
};
