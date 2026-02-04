const express = require('express');
const multer = require('multer');
const { uploadFile, getFileInfo } = require('../controllers/uploadController');
const { downloadFile, manualDeleteFile } = require('../controllers/downloadController');
const { getFileStatistics } = require('../utils/cleanup');
const {
  uploadLimiter,
  downloadLimiter,
  validateFileSize,
  validateExpirationParams
} = require('../middleware/security');

const router = express.Router();

// Configuration Multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800, // 50 MB par défaut
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accepter tous les types de fichiers
    // (le chiffrement côté client protège le contenu)
    cb(null, true);
  }
});

// Middleware de gestion des erreurs Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = (parseInt(process.env.MAX_FILE_SIZE) || 52428800) / 1024 / 1024;
      return res.status(413).json({
        error: 'Fichier trop volumineux',
        message: `La taille maximale autorisée est de ${maxSizeMB.toFixed(0)} MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Trop de fichiers',
        message: 'Vous ne pouvez uploader qu\'un seul fichier à la fois'
      });
    }
    return res.status(400).json({
      error: 'Erreur d\'upload',
      message: err.message
    });
  }
  next(err);
};

/**
 * ROUTES
 */

// Health check - vérifier que l'API fonctionne
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Upload d'un fichier
router.post(
  '/upload',
  uploadLimiter,
  upload.single('file'),
  handleMulterError,
  validateFileSize,
  validateExpirationParams,
  uploadFile
);

// Obtenir les informations d'un fichier
router.get(
  '/file/:id/info',
  getFileInfo
);

// Télécharger un fichier
router.get(
  '/download/:id',
  downloadLimiter,
  downloadFile
);

// Supprimer manuellement un fichier (admin)
router.delete(
  '/file/:id',
  manualDeleteFile
);

// Statistiques (admin/monitoring)
router.get('/stats', async (req, res) => {
  try {
    const stats = await getFileStatistics();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// Route pour tester le chiffrement (développement uniquement)
if (process.env.NODE_ENV === 'development') {
  router.get('/test', (req, res) => {
    res.json({
      message: 'API SecureVault - Mode Développement',
      endpoints: {
        'POST /api/upload': 'Uploader un fichier',
        'GET /api/download/:id': 'Télécharger un fichier',
        'GET /api/file/:id/info': 'Obtenir les infos d\'un fichier',
        'DELETE /api/file/:id': 'Supprimer un fichier',
        'GET /api/stats': 'Statistiques',
        'GET /api/health': 'Health check'
      }
    });
  });
}

// Gestion des routes non trouvées
router.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.method} ${req.path} n'existe pas`,
    availableEndpoints: [
      'POST /api/upload',
      'GET /api/download/:id',
      'GET /api/file/:id/info',
      'DELETE /api/file/:id',
      'GET /api/stats',
      'GET /api/health'
    ]
  });
});

module.exports = router;
