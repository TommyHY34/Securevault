const File = require('../models/File');
const { deleteFile } = require('../controllers/downloadController');
const { Op } = require('sequelize');

/**
 * Nettoie les fichiers expirés
 * @returns {Promise<number>} Nombre de fichiers supprimés
 */
const cleanupExpiredFiles = async () => {
  try {
    const now = new Date();
    
    console.log(`🧹 Démarrage du nettoyage des fichiers expirés...`);

    // Trouver tous les fichiers expirés
    const expiredFiles = await File.findAll({
      where: {
        isDeleted: false,
        [Op.or]: [
          // Expirés par date
          {
            expiresAt: {
              [Op.lt]: now
            }
          },
          // Expirés par nombre de téléchargements
          {
            [Op.and]: [
              {
                downloadCount: {
                  [Op.gte]: File.sequelize.col('max_downloads')
                }
              }
            ]
          }
        ]
      }
    });

    if (expiredFiles.length === 0) {
      console.log(`✅ Nettoyage terminé: aucun fichier expiré`);
      return 0;
    }

    console.log(`📋 ${expiredFiles.length} fichiers expirés trouvés`);

    let successCount = 0;
    let errorCount = 0;

    // Supprimer chaque fichier expiré
    for (const file of expiredFiles) {
      try {
        const success = await deleteFile(file);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la suppression du fichier ${file.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Nettoyage terminé: ${successCount} fichiers supprimés, ${errorCount} erreurs`);
    
    return successCount;

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage automatique:', error);
    return 0;
  }
};

/**
 * Obtenir des statistiques sur les fichiers
 */
const getFileStatistics = async () => {
  try {
    const { sequelize } = require('../config/database');
    
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_deleted = FALSE) as active_files,
        COUNT(*) FILTER (WHERE is_deleted = TRUE) as deleted_files,
        COUNT(*) as total_files,
        SUM(file_size) FILTER (WHERE is_deleted = FALSE) as total_size_bytes,
        AVG(download_count) FILTER (WHERE is_deleted = FALSE) as avg_downloads,
        MAX(created_at) as last_upload
      FROM files
    `, { type: sequelize.QueryTypes.SELECT });

    return stats[0];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des statistiques:', error);
    return null;
  }
};

/**
 * Nettoyer les anciens fichiers supprimés de la base de données
 * (optionnel - pour garder la DB propre)
 */
const cleanupOldDeletedFiles = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await File.destroy({
      where: {
        isDeleted: true,
        deletedAt: {
          [Op.lt]: cutoffDate
        }
      }
    });

    console.log(`🗑️ ${result} anciens fichiers supprimés de la base (plus de ${daysOld} jours)`);
    return result;

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des anciens fichiers:', error);
    return 0;
  }
};

/**
 * Démarre la tâche de nettoyage périodique
 */
const startCleanupJob = () => {
  const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 1;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`🕐 Tâche de nettoyage programmée toutes les ${intervalHours}h`);

  // Exécuter immédiatement au démarrage
  cleanupExpiredFiles();

  // Puis exécuter périodiquement
  setInterval(async () => {
    await cleanupExpiredFiles();
    
    // Nettoyer les vieux fichiers tous les jours (si l'intervalle est <= 1h)
    if (intervalHours <= 1) {
      const hour = new Date().getHours();
      if (hour === 3) { // 3h du matin
        await cleanupOldDeletedFiles(30);
      }
    }
  }, intervalMs);

  // Afficher les stats toutes les 6 heures
  setInterval(async () => {
    const stats = await getFileStatistics();
    if (stats) {
      console.log(`📊 Statistiques: ${stats.active_files} fichiers actifs, ${stats.deleted_files} supprimés, ${(stats.total_size_bytes / 1024 / 1024).toFixed(2)} MB utilisés`);
    }
  }, 6 * 60 * 60 * 1000);
};

/**
 * Nettoyer les fichiers orphelins (fichiers physiques sans entrée en DB)
 */
const cleanupOrphanedFiles = async () => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    
    // Lister tous les fichiers du dossier uploads
    const files = await fs.readdir(uploadDir);
    
    let orphanedCount = 0;
    
    for (const filename of files) {
      // Ignorer les dossiers
      const filePath = path.join(uploadDir, filename);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) continue;
      
      // Vérifier si le fichier existe en DB
      const fileInDb = await File.findOne({
        where: { filename: filename }
      });
      
      if (!fileInDb) {
        // Fichier orphelin, le supprimer
        await fs.unlink(filePath);
        orphanedCount++;
        console.log(`🗑️ Fichier orphelin supprimé: ${filename}`);
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`✅ ${orphanedCount} fichiers orphelins supprimés`);
    }
    
    return orphanedCount;
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des fichiers orphelins:', error);
    return 0;
  }
};

module.exports = {
  cleanupExpiredFiles,
  cleanupOldDeletedFiles,
  cleanupOrphanedFiles,
  getFileStatistics,
  startCleanupJob
};
