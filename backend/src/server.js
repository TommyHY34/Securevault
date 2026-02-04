const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const { sequelize, testConnection } = require('./config/database');
const routes = require('./routes');
const { startCleanupJob } = require('./utils/cleanup');
const {
  helmetConfig,
  globalLimiter,
  requestLogger,
  csrfProtection
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

/**
 * MIDDLEWARE DE SÉCURITÉ
 */

// Helmet - Headers de sécurité HTTP
app.use(helmetConfig);

// Rate limiting global
app.use(globalLimiter);

// Logger les requêtes (dev uniquement)
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

/**
 * CONFIGURATION CORS
 */
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://*.githubpreview.dev', // GitHub Codespaces
  'https://*.github.dev' // GitHub Codespaces
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    // Vérifier si l'origin est dans la liste
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        // Gérer les wildcards
        const regex = new RegExp(allowed.replace('*', '.*'));
        return regex.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqué pour origine: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * BODY PARSER
 */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/**
 * PROTECTION CSRF
 */
app.use(csrfProtection);

/**
 * ROUTES
 */
app.use('/api', routes);

// Route racine
app.get('/', (req, res) => {
  res.json({
    name: 'SecureVault API',
    version: '1.0.0',
    description: 'Service de partage de fichiers éphémères chiffrés',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/api/health',
      upload: 'POST /api/upload',
      download: 'GET /api/download/:id',
      info: 'GET /api/file/:id/info'
    }
  });
});

/**
 * GESTION DES ERREURS
 */

// Erreur 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);

  // Erreur CORS
  if (err.message === 'Non autorisé par CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origine non autorisée'
    });
  }

  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  // Erreur générique
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Une erreur interne est survenue',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/**
 * GESTION DE L'ARRÊT GRACIEUX
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Signal ${signal} reçu, arrêt gracieux...`);

  // Fermer le serveur
  server.close(async () => {
    console.log('✅ Serveur HTTP fermé');

    try {
      // Fermer la connexion à la base de données
      await sequelize.close();
      console.log('✅ Connexion base de données fermée');

      process.exit(0);
    } catch (error) {
      console.error('❌ Erreur lors de l\'arrêt:', error);
      process.exit(1);
    }
  });

  // Forcer l'arrêt après 10 secondes
  setTimeout(() => {
    console.error('⏰ Arrêt forcé après timeout');
    process.exit(1);
  }, 10000);
};

// Écouter les signaux d'arrêt
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gérer les erreurs non catchées
process.on('uncaughtException', (error) => {
  console.error('❌ Exception non catchée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejetée non gérée:', reason);
  process.exit(1);
});

/**
 * DÉMARRAGE DU SERVEUR
 */
const startServer = async () => {
  try {
    console.log('🚀 Démarrage de SecureVault Backend...');
    console.log('=====================================');

    // Test de connexion à la base de données
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Impossible de se connecter à la base de données');
    }

    // Synchroniser les modèles (en développement uniquement)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Modèles synchronisés');
    }

    // Créer le dossier uploads s'il n'existe pas
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    const tempDir = path.join(uploadDir, 'temp');
    
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    console.log('✅ Dossiers d\'upload créés');

    // Démarrer le serveur HTTP
    const server = app.listen(PORT, HOST, () => {
      console.log(`\n✅ Serveur démarré avec succès !`);
      console.log(`📍 URL: http://${HOST}:${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📁 Dossier uploads: ${uploadDir}`);
      console.log(`🗄️  Base de données: ${process.env.DB_NAME}`);
      console.log(`\n📖 Documentation API: http://${HOST}:${PORT}/`);
      console.log(`❤️  Health check: http://${HOST}:${PORT}/api/health`);
      console.log('\n👉 Appuyez sur Ctrl+C pour arrêter\n');
    });

    // Démarrer la tâche de nettoyage automatique
    startCleanupJob();

    // Exposer le serveur pour le graceful shutdown
    global.server = server;

  } catch (error) {
    console.error('❌ Erreur fatale lors du démarrage:', error);
    process.exit(1);
  }
};

// Démarrer le serveur
startServer();

module.exports = app;
