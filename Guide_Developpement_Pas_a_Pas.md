# 🚀 GUIDE PAS À PAS - DÉVELOPPEMENT SECUREVAULT
## De zéro à l'application complète

---

## 📋 TABLE DES MATIÈRES

1. [Prérequis et installation](#1-prérequis-et-installation)
2. [Initialisation du projet](#2-initialisation-du-projet)
3. [Configuration de la base de données](#3-configuration-de-la-base-de-données)
4. [Développement du Backend](#4-développement-du-backend)
5. [Développement du Frontend](#5-développement-du-frontend)
6. [Chiffrement côté client](#6-chiffrement-côté-client)
7. [Tests et validation](#7-tests-et-validation)
8. [Pipeline DevSecOps](#8-pipeline-devsecops)
9. [Déploiement](#9-déploiement)
10. [Monitoring et maintenance](#10-monitoring-et-maintenance)

---

## 1. PRÉREQUIS ET INSTALLATION

### 1.1 Logiciels nécessaires

```bash
# Vérifier les versions installées
node --version    # Devrait être >= 18.x
npm --version     # Devrait être >= 9.x
git --version     # N'importe quelle version récente
```

### 1.2 Installer les outils manquants

**Sur Ubuntu/Debian :**
```bash
# Node.js et npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Docker (optionnel mais recommandé)
sudo apt-get install -y docker.io docker-compose
```

**Sur macOS :**
```bash
# Avec Homebrew
brew install node
brew install postgresql
brew install docker docker-compose
```

**Sur Windows :**
- Télécharger Node.js depuis https://nodejs.org/
- Télécharger PostgreSQL depuis https://www.postgresql.org/download/windows/
- Télécharger Docker Desktop depuis https://www.docker.com/products/docker-desktop

---

## 2. INITIALISATION DU PROJET

### 2.1 Créer la structure du projet

```bash
# Créer le dossier principal
mkdir securevault
cd securevault

# Créer la structure
mkdir -p backend frontend docs tests
```

### 2.2 Initialiser Git

```bash
git init
git config user.name "Votre Nom"
git config user.email "votre.email@example.com"

# Créer le .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# Build output
dist/
build/
uploads/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Database
*.db
*.sqlite

# Secrets
secrets/
*.pem
*.key
EOF

git add .gitignore
git commit -m "Initial commit: project structure"
```

### 2.3 Créer le README

```bash
cat > README.md << 'EOF'
# 🔐 SecureVault

Service de partage de fichiers éphémères avec chiffrement de bout en bout (AES-256-GCM).

## Fonctionnalités

- Chiffrement AES-256-GCM côté client
- Liens uniques non prédictibles
- Expiration automatique (lectures/durée)
- Zero-knowledge (le serveur ne peut pas déchiffrer)
- Pipeline DevSecOps complet

## Installation

Voir [INSTALL.md](./INSTALL.md) pour les instructions détaillées.

## Architecture

Voir [docs/architecture.md](./docs/architecture.md)

## Sécurité

Voir [docs/security.md](./docs/security.md)
EOF

git add README.md
git commit -m "Add README"
```

---

## 3. CONFIGURATION DE LA BASE DE DONNÉES

### 3.1 Créer la base de données PostgreSQL

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans le shell PostgreSQL
CREATE DATABASE securevault;
CREATE USER securevault_user WITH PASSWORD 'votre_mot_de_passe_fort';
GRANT ALL PRIVILEGES ON DATABASE securevault TO securevault_user;
\q
```

### 3.2 Créer le schéma de la base

```bash
cd backend
mkdir sql
cat > sql/schema.sql << 'EOF'
-- Table des fichiers partagés
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    
    -- Métadonnées d'expiration
    max_downloads INTEGER DEFAULT 1,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    
    -- Métadonnées système
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    -- Statut
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_expires_at ON files(expires_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_files_is_deleted ON files(is_deleted);

-- Table des logs d'accès (optionnel mais recommandé)
CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'upload', 'download', 'delete'
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

CREATE INDEX idx_access_logs_file_id ON access_logs(file_id);
CREATE INDEX idx_access_logs_timestamp ON access_logs(timestamp);

-- Vue pour les statistiques
CREATE VIEW file_statistics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_uploads,
    SUM(file_size) as total_size,
    AVG(download_count) as avg_downloads
FROM files
WHERE is_deleted = FALSE
GROUP BY DATE_TRUNC('day', created_at);
EOF
```

### 3.3 Appliquer le schéma

```bash
psql -U securevault_user -d securevault -f sql/schema.sql
```

---

## 4. DÉVELOPPEMENT DU BACKEND

### 4.1 Initialiser le projet Node.js

```bash
cd backend
npm init -y

# Installer les dépendances
npm install express cors dotenv
npm install pg sequelize
npm install multer
npm install helmet express-rate-limit
npm install uuid
npm install winston  # Pour les logs

# Dépendances de développement
npm install --save-dev nodemon jest supertest eslint
```

### 4.2 Créer la configuration

```bash
# Fichier .env
cat > .env << 'EOF'
# Serveur
NODE_ENV=development
PORT=3001
HOST=localhost

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_NAME=securevault
DB_USER=securevault_user
DB_PASSWORD=votre_mot_de_passe_fort

# Fichiers
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50 MB en bytes

# Sécurité
RATE_LIMIT_WINDOW=900000  # 15 minutes en ms
RATE_LIMIT_MAX=100        # Max 100 requêtes par fenêtre

# Expiration
DEFAULT_MAX_DOWNLOADS=1
DEFAULT_EXPIRY_HOURS=24
CLEANUP_INTERVAL_HOURS=1
EOF

# Ne JAMAIS commit le .env !
echo ".env" >> .gitignore
```

### 4.3 Structure du backend

```bash
mkdir -p src/{config,controllers,models,routes,middleware,utils}
mkdir -p uploads
```

### 4.4 Configuration de base (src/config/database.js)

```javascript
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
```

### 4.5 Modèle File (src/models/File.js)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const File = sequelize.define('File', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  originalFilename: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false
  },
  mimeType: {
    type: DataTypes.STRING(100)
  },
  maxDownloads: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  expiresAt: {
    type: DataTypes.DATE
  },
  ipAddress: {
    type: DataTypes.INET
  },
  userAgent: {
    type: DataTypes.TEXT
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedAt: {
    type: DataTypes.DATE
  },
  lastAccessedAt: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'files',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = File;
```

### 4.6 Middleware de sécurité (src/middleware/security.js)

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Configuration Helmet pour les headers de sécurité
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 an
    includeSubDomains: true,
    preload: true
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Trop de requêtes, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation des entrées
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
};

module.exports = {
  helmetConfig,
  limiter,
  sanitizeFilename
};
```

### 4.7 Contrôleur Upload (src/controllers/uploadController.js)

```javascript
const File = require('../models/File');
const { sanitizeFilename } = require('../middleware/security');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const uploadFile = async (req, res) => {
  try {
    // Vérifier que le fichier existe
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Paramètres d'expiration
    const maxDownloads = parseInt(req.body.maxDownloads) || 1;
    const expiryHours = parseInt(req.body.expiryHours) || 24;
    
    // Validation
    if (maxDownloads < 1 || maxDownloads > 100) {
      return res.status(400).json({ error: 'maxDownloads doit être entre 1 et 100' });
    }
    if (expiryHours < 1 || expiryHours > 168) { // Max 7 jours
      return res.status(400).json({ error: 'expiryHours doit être entre 1 et 168' });
    }

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    // Générer un nom de fichier unique
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFilename = `${uuidv4()}${fileExtension}`;
    const finalPath = path.join(process.env.UPLOAD_DIR, uniqueFilename);

    // Déplacer le fichier
    await fs.rename(req.file.path, finalPath);

    // Créer l'entrée en base de données
    const file = await File.create({
      filename: uniqueFilename,
      originalFilename: sanitizeFilename(req.file.originalname),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      maxDownloads: maxDownloads,
      expiresAt: expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Logger l'upload
    console.log(`File uploaded: ${file.id} by IP ${req.ip}`);

    // Retourner l'UUID (la clé sera ajoutée côté client)
    res.status(201).json({
      id: file.id,
      originalFilename: file.originalFilename,
      fileSize: file.fileSize,
      maxDownloads: file.maxDownloads,
      expiresAt: file.expiresAt
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Nettoyer le fichier en cas d'erreur
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.status(500).json({ error: 'Erreur lors de l\'upload du fichier' });
  }
};

module.exports = { uploadFile };
```

### 4.8 Contrôleur Download (src/controllers/downloadController.js)

```javascript
const File = require('../models/File');
const path = require('path');
const fs = require('fs').promises;

const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer les métadonnées
    const file = await File.findByPk(id);

    if (!file || file.isDeleted) {
      return res.status(404).json({ error: 'Fichier introuvable' });
    }

    // Vérifier l'expiration par date
    if (file.expiresAt && new Date() > new Date(file.expiresAt)) {
      await deleteFile(file);
      return res.status(410).json({ error: 'Fichier expiré' });
    }

    // Vérifier l'expiration par nombre de téléchargements
    if (file.downloadCount >= file.maxDownloads) {
      await deleteFile(file);
      return res.status(410).json({ error: 'Limite de téléchargements atteinte' });
    }

    // Chemin du fichier
    const filePath = path.join(process.env.UPLOAD_DIR, file.filename);

    // Vérifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Fichier physique introuvable' });
    }

    // Incrémenter le compteur
    file.downloadCount += 1;
    file.lastAccessedAt = new Date();
    await file.save();

    // Logger le download
    console.log(`File downloaded: ${file.id} (${file.downloadCount}/${file.maxDownloads})`);

    // Si c'était le dernier téléchargement autorisé, supprimer
    if (file.downloadCount >= file.maxDownloads) {
      // Supprimer de manière asynchrone après l'envoi
      setImmediate(async () => {
        await deleteFile(file);
      });
    }

    // Envoyer le fichier
    res.download(filePath, file.originalFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Erreur lors du téléchargement' });
  }
};

// Fonction helper pour supprimer un fichier
const deleteFile = async (file) => {
  try {
    // Supprimer le fichier physique
    const filePath = path.join(process.env.UPLOAD_DIR, file.filename);
    await fs.unlink(filePath);

    // Marquer comme supprimé en base
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    console.log(`File deleted: ${file.id}`);
  } catch (error) {
    console.error('Delete error:', error);
  }
};

module.exports = { downloadFile };
```

### 4.9 Routes (src/routes/index.js)

```javascript
const express = require('express');
const multer = require('multer');
const { uploadFile } = require('../controllers/uploadController');
const { downloadFile } = require('../controllers/downloadController');

const router = express.Router();

// Configuration Multer
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 // 50 MB
  },
  fileFilter: (req, file, cb) => {
    // Vous pouvez ajouter des filtres ici si nécessaire
    cb(null, true);
  }
});

// Routes
router.post('/upload', upload.single('file'), uploadFile);
router.get('/download/:id', downloadFile);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
```

### 4.10 Serveur principal (src/server.js)

```javascript
const express = require('express');
const cors = require('cors');
const { helmetConfig, limiter } = require('./middleware/security');
const routes = require('./routes');
const sequelize = require('./config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de sécurité
app.use(helmetConfig);
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Démarrage du serveur
const startServer = async () => {
  try {
    // Test de connexion à la base de données
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données réussie');

    // Synchroniser les modèles (en dev uniquement)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
    }

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Erreur de démarrage:', error);
    process.exit(1);
  }
};

startServer();
```

### 4.11 Tâche de nettoyage (src/utils/cleanup.js)

```javascript
const File = require('../models/File');
const fs = require('fs').promises;
const path = require('path');

const cleanupExpiredFiles = async () => {
  try {
    const now = new Date();
    
    // Trouver les fichiers expirés
    const expiredFiles = await File.findAll({
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

    console.log(`🧹 Nettoyage: ${expiredFiles.length} fichiers expirés trouvés`);

    for (const file of expiredFiles) {
      // Supprimer le fichier physique
      const filePath = path.join(process.env.UPLOAD_DIR, file.filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error(`Erreur suppression fichier ${file.id}:`, error);
      }

      // Marquer comme supprimé
      file.isDeleted = true;
      file.deletedAt = now;
      await file.save();
    }

    console.log(`✅ Nettoyage terminé: ${expiredFiles.length} fichiers supprimés`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  }
};

// Lancer le nettoyage périodiquement
const startCleanupJob = () => {
  const intervalHours = parseInt(process.env.CLEANUP_INTERVAL_HOURS) || 1;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`🕐 Tâche de nettoyage programmée toutes les ${intervalHours}h`);
  
  setInterval(cleanupExpiredFiles, intervalMs);
  
  // Exécuter une fois au démarrage
  cleanupExpiredFiles();
};

module.exports = { cleanupExpiredFiles, startCleanupJob };
```

### 4.12 Modifier server.js pour inclure le cleanup

Ajoutez dans `src/server.js` après le démarrage :

```javascript
// Ajouter en haut
const { startCleanupJob } = require('./utils/cleanup');

// Ajouter dans startServer() après app.listen()
startCleanupJob();
```

### 4.13 Scripts npm (package.json)

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "lint": "eslint src/"
  }
}
```

---

## 5. DÉVELOPPEMENT DU FRONTEND

### 5.1 Créer l'application React

```bash
cd ../frontend
npx create-react-app .

# Installer les dépendances supplémentaires
npm install axios
npm install react-dropzone
npm install @fortawesome/fontawesome-free
```

### 5.2 Structure du frontend

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── Upload.js
│   │   ├── Download.js
│   │   └── Header.js
│   ├── utils/
│   │   └── crypto.js
│   ├── App.js
│   ├── App.css
│   └── index.js
```

---

## 6. CHIFFREMENT CÔTÉ CLIENT

### 6.1 Module de chiffrement (src/utils/crypto.js)

```javascript
// Génération d'une clé AES-256
export const generateKey = async () => {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
};

// Exporter la clé en base64
export const exportKey = async (key) => {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
};

// Importer une clé depuis base64
export const importKey = async (base64Key) => {
  const keyData = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'raw',
    keyData,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  );
};

// Chiffrer un fichier
export const encryptFile = async (file, key) => {
  // Lire le fichier
  const fileData = await file.arrayBuffer();
  
  // Générer un IV aléatoire (12 bytes pour GCM)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Chiffrer
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    fileData
  );
  
  // Combiner IV + données chiffrées
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Créer un nouveau Blob
  return new Blob([combined], { type: 'application/octet-stream' });
};

// Déchiffrer un fichier
export const decryptFile = async (encryptedBlob, key, originalType) => {
  const data = await encryptedBlob.arrayBuffer();
  const dataView = new Uint8Array(data);
  
  // Extraire IV (12 premiers bytes)
  const iv = dataView.slice(0, 12);
  
  // Extraire les données chiffrées
  const encrypted = dataView.slice(12);
  
  // Déchiffrer
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encrypted
  );
  
  // Retourner le blob avec le type d'origine
  return new Blob([decrypted], { type: originalType });
};

// Helpers
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};
```

### 6.2 Composant Upload (src/components/Upload.js)

```javascript
import React, { useState } from 'react';
import axios from 'axios';
import { generateKey, exportKey, encryptFile } from '../utils/crypto';

const Upload = () => {
  const [file, setFile] = useState(null);
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [expiryHours, setExpiryHours] = useState(24);
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // 1. Générer une clé de chiffrement
      const key = await generateKey();
      const keyString = await exportKey(key);

      // 2. Chiffrer le fichier
      const encryptedBlob = await encryptFile(file, key);

      // 3. Créer un FormData avec le fichier chiffré
      const formData = new FormData();
      formData.append('file', encryptedBlob, file.name);
      formData.append('maxDownloads', maxDownloads);
      formData.append('expiryHours', expiryHours);

      // 4. Upload vers le serveur
      const response = await axios.post(
        'http://localhost:3001/api/upload',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      // 5. Créer le lien avec la clé dans le fragment
      const downloadLink = `${window.location.origin}/download/${response.data.id}#${keyString}`;
      setLink(downloadLink);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(link);
    alert('Lien copié !');
  };

  return (
    <div className="upload-container">
      <h2>📤 Partager un fichier</h2>
      
      {!link ? (
        <>
          <div className="file-input">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              disabled={uploading}
            />
          </div>

          <div className="options">
            <label>
              Nombre max de téléchargements:
              <select
                value={maxDownloads}
                onChange={(e) => setMaxDownloads(parseInt(e.target.value))}
                disabled={uploading}
              >
                <option value={1}>1 (recommandé)</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={100}>100</option>
              </select>
            </label>

            <label>
              Durée de vie:
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(parseInt(e.target.value))}
                disabled={uploading}
              >
                <option value={1}>1 heure</option>
                <option value={24}>24 heures (recommandé)</option>
                <option value={72}>3 jours</option>
                <option value={168}>7 jours</option>
              </select>
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary"
          >
            {uploading ? '⏳ Chiffrement et upload...' : '🔒 Chiffrer et partager'}
          </button>

          {error && <div className="error">{error}</div>}
        </>
      ) : (
        <div className="success">
          <h3>✅ Fichier partagé avec succès !</h3>
          <div className="link-container">
            <input type="text" value={link} readOnly />
            <button onClick={copyToClipboard}>📋 Copier</button>
          </div>
          <p className="warning">
            ⚠️ Ce lien contient la clé de déchiffrement. Partagez-le de manière sécurisée.
          </p>
          <button onClick={() => setLink('')} className="btn-secondary">
            Partager un autre fichier
          </button>
        </div>
      )}
    </div>
  );
};

export default Upload;
```

### 6.3 Composant Download (src/components/Download.js)

```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { importKey, decryptFile } from '../utils/crypto';

const Download = () => {
  const { id } = useParams();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);

  useEffect(() => {
    // Extraire la clé du fragment d'URL
    const key = window.location.hash.substring(1);
    if (!key) {
      setError('Clé de déchiffrement manquante dans le lien');
    }
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setError('');

    try {
      // 1. Extraire la clé du fragment
      const keyString = window.location.hash.substring(1);
      if (!keyString) {
        throw new Error('Clé de déchiffrement manquante');
      }

      // 2. Importer la clé
      const key = await importKey(keyString);

      // 3. Télécharger le fichier chiffré
      const response = await axios.get(
        `http://localhost:3001/api/download/${id}`,
        { responseType: 'blob' }
      );

      // Récupérer le nom du fichier depuis les headers
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'downloaded_file';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }

      // 4. Déchiffrer le fichier
      const decryptedBlob = await decryptFile(
        response.data,
        key,
        'application/octet-stream'
      );

      // 5. Télécharger le fichier déchiffré
      const url = window.URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setFileInfo({
        message: '✅ Fichier téléchargé et déchiffré avec succès !',
        filename: filename
      });

    } catch (err) {
      console.error('Download error:', err);
      if (err.response?.status === 404) {
        setError('❌ Fichier introuvable ou déjà supprimé');
      } else if (err.response?.status === 410) {
        setError('❌ Fichier expiré ou limite de téléchargements atteinte');
      } else {
        setError(`❌ Erreur: ${err.message}`);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="download-container">
      <h2>📥 Télécharger le fichier</h2>

      {!fileInfo ? (
        <>
          <button
            onClick={handleDownload}
            disabled={downloading || error}
            className="btn-primary"
          >
            {downloading ? '⏳ Téléchargement et déchiffrement...' : '🔓 Télécharger le fichier'}
          </button>

          {error && <div className="error">{error}</div>}

          <div className="info">
            <p>ℹ️ Ce fichier sera déchiffré localement dans votre navigateur.</p>
            <p>⚠️ Attention: ce lien peut avoir une durée de vie limitée.</p>
          </div>
        </>
      ) : (
        <div className="success">
          <h3>{fileInfo.message}</h3>
          <p>Fichier: <strong>{fileInfo.filename}</strong></p>
        </div>
      )}
    </div>
  );
};

export default Download;
```

---

*La suite du guide (sections 7-10) sera dans le prochain message pour respecter la limite de longueur.*

**Voulez-vous que je continue avec :**
- Tests et validation
- Pipeline DevSecOps
- Déploiement
- Monitoring

**Ou préférez-vous commencer à implémenter ce que nous avons déjà couvert ?**
