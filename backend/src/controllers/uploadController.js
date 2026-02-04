const File = require('../models/File');
const { sanitizeFilename } = require('../middleware/security');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

/**
 * Contrôleur pour l'upload de fichiers
 */
const uploadFile = async (req, res) => {
  let tempFilePath = null;
  
  try {
    // Vérifier que le fichier existe
    if (!req.file) {
      return res.status(400).json({ 
        error: 'Aucun fichier fourni',
        message: 'Veuillez sélectionner un fichier à uploader'
      });
    }

    tempFilePath = req.file.path;

    // Récupérer les paramètres d'expiration
    const maxDownloads = parseInt(req.body.maxDownloads) || 
                        parseInt(process.env.DEFAULT_MAX_DOWNLOADS) || 1;
    const expiryHours = parseInt(req.body.expiryHours) || 
                       parseInt(process.env.DEFAULT_EXPIRY_HOURS) || 24;

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Générer un nom de fichier unique
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    const finalPath = path.join(uploadDir, uniqueFilename);

    // S'assurer que le dossier existe
    await fs.mkdir(uploadDir, { recursive: true });

    // Déplacer le fichier du dossier temp vers le dossier final
    await fs.rename(tempFilePath, finalPath);
    tempFilePath = null; // Fichier déplacé avec succès

    // Sanitizer le nom original
    const sanitizedOriginalName = sanitizeFilename(req.file.originalname);

    // Créer l'entrée en base de données
    const file = await File.create({
      filename: uniqueFilename,
      originalFilename: sanitizedOriginalName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      maxDownloads: maxDownloads,
      expiresAt: expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Logger l'upload avec succès
    console.log(`✅ Upload réussi: ${file.id} | Fichier: ${sanitizedOriginalName} | IP: ${req.ip} | Taille: ${(file.fileSize / 1024).toFixed(2)} KB`);

    // Créer un log d'accès
    try {
      const { sequelize } = require('../config/database');
      await sequelize.query(
        'INSERT INTO access_logs (file_id, action, ip_address, user_agent, success) VALUES ($1, $2, $3, $4, $5)',
        {
          bind: [file.id, 'upload', req.ip, req.get('user-agent'), true]
        }
      );
    } catch (logError) {
      console.error('⚠️ Erreur lors de la création du log:', logError.message);
    }

    // Retourner les informations (sans la clé de chiffrement)
    res.status(201).json({
      success: true,
      id: file.id,
      originalFilename: file.originalFilename,
      fileSize: file.fileSize,
      maxDownloads: file.maxDownloads,
      expiresAt: file.expiresAt,
      message: 'Fichier uploadé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur upload:', error);

    // Nettoyer le fichier temporaire en cas d'erreur
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        console.error('⚠️ Erreur lors de la suppression du fichier temp:', unlinkError.message);
      }
    }

    // Gérer les différentes erreurs
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Données invalides',
        message: error.errors[0]?.message || 'Les données fournies sont invalides',
        details: error.errors.map(e => e.message)
      });
    }

    if (error.code === 'ENOSPC') {
      return res.status(507).json({
        error: 'Espace disque insuffisant',
        message: 'Le serveur n\'a plus d\'espace de stockage disponible'
      });
    }

    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Une erreur est survenue lors de l\'upload du fichier'
    });
  }
};

/**
 * Obtenir les informations d'un fichier (sans le télécharger)
 */
const getFileInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findByPk(id);

    if (!file || file.isDeleted) {
      return res.status(404).json({ 
        error: 'Fichier introuvable',
        message: 'Ce fichier n\'existe pas ou a été supprimé'
      });
    }

    // Vérifier l'expiration
    if (file.isExpired()) {
      return res.status(410).json({ 
        error: 'Fichier expiré',
        message: 'Ce fichier a expiré et n\'est plus disponible'
      });
    }

    res.json({
      success: true,
      originalFilename: file.originalFilename,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      remainingDownloads: file.getRemainingDownloads(),
      expiresAt: file.expiresAt,
      createdAt: file.created_at
    });

  } catch (error) {
    console.error('❌ Erreur get file info:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Impossible de récupérer les informations du fichier'
    });
  }
};

module.exports = { 
  uploadFile,
  getFileInfo
};
