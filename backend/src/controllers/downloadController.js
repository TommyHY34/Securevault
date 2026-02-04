const File = require('../models/File');
const path = require('path');
const fs = require('fs').promises;

/**
 * Contrôleur pour le téléchargement de fichiers
 */
const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer les métadonnées du fichier
    const file = await File.findByPk(id);

    if (!file || file.isDeleted) {
      console.warn(`⚠️ Tentative d'accès à un fichier inexistant: ${id} | IP: ${req.ip}`);
      return res.status(404).json({ 
        error: 'Fichier introuvable',
        message: 'Ce fichier n\'existe pas ou a déjà été supprimé'
      });
    }

    // Vérifier l'expiration par date
    if (file.expiresAt && new Date() > new Date(file.expiresAt)) {
      console.log(`⏰ Fichier expiré (date): ${file.id}`);
      await deleteFile(file);
      return res.status(410).json({ 
        error: 'Fichier expiré',
        message: 'Ce fichier a expiré et n\'est plus disponible'
      });
    }

    // Vérifier l'expiration par nombre de téléchargements
    if (file.downloadCount >= file.maxDownloads) {
      console.log(`⏰ Fichier expiré (téléchargements): ${file.id} (${file.downloadCount}/${file.maxDownloads})`);
      await deleteFile(file);
      return res.status(410).json({ 
        error: 'Limite de téléchargements atteinte',
        message: 'Ce fichier a atteint sa limite de téléchargements et n\'est plus disponible'
      });
    }

    // Chemin du fichier sur le disque
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    const filePath = path.join(uploadDir, file.filename);

    // Vérifier que le fichier existe physiquement
    try {
      await fs.access(filePath);
    } catch {
      console.error(`❌ Fichier physique introuvable: ${filePath}`);
      
      // Marquer comme supprimé car le fichier physique n'existe pas
      file.isDeleted = true;
      file.deletedAt = new Date();
      await file.save();
      
      return res.status(404).json({ 
        error: 'Fichier physique introuvable',
        message: 'Le fichier est corrompu ou a été supprimé du système'
      });
    }

    // Incrémenter le compteur de téléchargements
    file.downloadCount += 1;
    file.lastAccessedAt = new Date();
    await file.save();

    // Logger le download
    console.log(`📥 Download: ${file.id} | Fichier: ${file.originalFilename} | IP: ${req.ip} | ${file.downloadCount}/${file.maxDownloads}`);

    // Créer un log d'accès
    try {
      const { sequelize } = require('../config/database');
      await sequelize.query(
        'INSERT INTO access_logs (file_id, action, ip_address, user_agent, success) VALUES ($1, $2, $3, $4, $5)',
        {
          bind: [file.id, 'download', req.ip, req.get('user-agent'), true]
        }
      );
    } catch (logError) {
      console.error('⚠️ Erreur lors de la création du log:', logError.message);
    }

    // Si c'était le dernier téléchargement autorisé, programmer la suppression
    if (file.downloadCount >= file.maxDownloads) {
      console.log(`🗑️ Dernier téléchargement, programmation de la suppression: ${file.id}`);
      
      // Supprimer de manière asynchrone après l'envoi du fichier
      setImmediate(async () => {
        await deleteFile(file);
      });
    }

    // Définir les headers de réponse
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalFilename)}"`);
    res.setHeader('Content-Length', file.fileSize);
    res.setHeader('X-Remaining-Downloads', file.getRemainingDownloads());
    
    // Headers de sécurité supplémentaires
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Download-Options', 'noopen');

    // Envoyer le fichier
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'envoi du fichier:', err);
        
        // Si le fichier n'a pas encore été envoyé
        if (!res.headersSent) {
          res.status(500).json({ 
            error: 'Erreur lors du téléchargement',
            message: 'Une erreur est survenue lors de l\'envoi du fichier'
          });
        }
      }
    });

  } catch (error) {
    console.error('❌ Erreur download:', error);
    
    // Logger l'échec
    try {
      const { sequelize } = require('../config/database');
      await sequelize.query(
        'INSERT INTO access_logs (file_id, action, ip_address, user_agent, success, error_message) VALUES ($1, $2, $3, $4, $5, $6)',
        {
          bind: [req.params.id, 'download', req.ip, req.get('user-agent'), false, error.message]
        }
      );
    } catch (logError) {
      console.error('⚠️ Erreur lors de la création du log:', logError.message);
    }
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erreur serveur',
        message: 'Une erreur est survenue lors du téléchargement'
      });
    }
  }
};

/**
 * Fonction helper pour supprimer un fichier de manière sécurisée
 */
const deleteFile = async (file) => {
  try {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    const filePath = path.join(uploadDir, file.filename);

    // Supprimer le fichier physique
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ Fichier physique supprimé: ${file.filename}`);
    } catch (unlinkError) {
      if (unlinkError.code !== 'ENOENT') {
        console.error(`⚠️ Erreur suppression fichier ${file.filename}:`, unlinkError.message);
      }
    }

    // Marquer comme supprimé en base de données
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    // Logger la suppression
    console.log(`✅ Fichier marqué comme supprimé: ${file.id}`);

    // Créer un log de suppression
    try {
      const { sequelize } = require('../config/database');
      await sequelize.query(
        'INSERT INTO access_logs (file_id, action, success) VALUES ($1, $2, $3)',
        {
          bind: [file.id, 'delete', true]
        }
      );
    } catch (logError) {
      console.error('⚠️ Erreur lors de la création du log:', logError.message);
    }

    return true;
  } catch (error) {
    console.error(`❌ Erreur lors de la suppression du fichier ${file.id}:`, error);
    return false;
  }
};

/**
 * Supprimer manuellement un fichier (admin)
 */
const manualDeleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await File.findByPk(id);

    if (!file) {
      return res.status(404).json({ 
        error: 'Fichier introuvable',
        message: 'Ce fichier n\'existe pas'
      });
    }

    if (file.isDeleted) {
      return res.status(410).json({ 
        error: 'Fichier déjà supprimé',
        message: 'Ce fichier a déjà été supprimé'
      });
    }

    await deleteFile(file);

    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur manual delete:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: 'Impossible de supprimer le fichier'
    });
  }
};

module.exports = { 
  downloadFile,
  deleteFile,
  manualDeleteFile
};
