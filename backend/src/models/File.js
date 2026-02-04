const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'Identifiant unique du fichier (UUID v4)'
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Nom du fichier sur le disque (avec UUID)'
  },
  originalFilename: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'original_filename',
    comment: 'Nom original du fichier uploadé'
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'file_size',
    validate: {
      min: 1,
      max: 52428800 // 50 MB
    },
    comment: 'Taille du fichier en bytes'
  },
  mimeType: {
    type: DataTypes.STRING(100),
    field: 'mime_type',
    comment: 'Type MIME du fichier'
  },
  maxDownloads: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'max_downloads',
    validate: {
      min: 1,
      max: 100
    },
    comment: 'Nombre maximum de téléchargements autorisés'
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'download_count',
    validate: {
      min: 0
    },
    comment: 'Nombre actuel de téléchargements'
  },
  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at',
    comment: 'Date d\'expiration du fichier'
  },
  ipAddress: {
    type: DataTypes.INET,
    field: 'ip_address',
    comment: 'Adresse IP de l\'uploader'
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent',
    comment: 'User agent du navigateur'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_deleted',
    comment: 'Indique si le fichier est supprimé'
  },
  deletedAt: {
    type: DataTypes.DATE,
    field: 'deleted_at',
    comment: 'Date de suppression du fichier'
  },
  lastAccessedAt: {
    type: DataTypes.DATE,
    field: 'last_accessed_at',
    comment: 'Date du dernier accès au fichier'
  }
}, {
  tableName: 'files',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // Pas de colonne updated_at
  indexes: [
    { fields: ['created_at'] },
    { fields: ['expires_at'], where: { is_deleted: false } },
    { fields: ['is_deleted'] }
  ]
});

// Méthodes d'instance
File.prototype.isExpired = function() {
  const now = new Date();
  
  // Expiré par date
  if (this.expiresAt && now > this.expiresAt) {
    return true;
  }
  
  // Expiré par nombre de téléchargements
  if (this.downloadCount >= this.maxDownloads) {
    return true;
  }
  
  return false;
};

File.prototype.canBeDownloaded = function() {
  return !this.isDeleted && !this.isExpired();
};

File.prototype.getRemainingDownloads = function() {
  return Math.max(0, this.maxDownloads - this.downloadCount);
};

File.prototype.getTimeUntilExpiry = function() {
  if (!this.expiresAt) return null;
  const now = new Date();
  return Math.max(0, this.expiresAt - now);
};

// Méthodes de classe
File.findActiveFiles = async function() {
  return await File.findAll({
    where: {
      isDeleted: false
    },
    order: [['created_at', 'DESC']]
  });
};

File.findExpiredFiles = async function() {
  const now = new Date();
  const { Op } = require('sequelize');
  
  return await File.findAll({
    where: {
      isDeleted: false,
      [Op.or]: [
        { expiresAt: { [Op.lt]: now } },
        sequelize.where(
          sequelize.col('download_count'),
          '>=',
          sequelize.col('max_downloads')
        )
      ]
    }
  });
};

module.exports = File;
