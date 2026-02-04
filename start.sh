#!/bin/bash

echo "🚀 Démarrage de SecureVault..."
echo "=============================="

# Vérifier que PostgreSQL tourne
if ! sudo service postgresql status &> /dev/null; then
    echo "📥 Démarrage de PostgreSQL..."
    sudo service postgresql start
fi

# Créer les fichiers .env s'ils n'existent pas
if [ ! -f backend/.env ]; then
    echo "📝 Création du fichier backend/.env..."
    cat > backend/.env << 'EOF'
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

DB_HOST=localhost
DB_PORT=5432
DB_NAME=securevault
DB_USER=securevault_user
DB_PASSWORD=SecureVault2026!

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

DEFAULT_MAX_DOWNLOADS=1
DEFAULT_EXPIRY_HOURS=24
CLEANUP_INTERVAL_HOURS=1

FRONTEND_URL=http://localhost:3000
EOF
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Création du fichier frontend/.env..."
    cat > frontend/.env << 'EOF'
REACT_APP_API_URL=http://localhost:3001/api
EOF
fi

# Fonction pour arrêter proprement
cleanup() {
    echo ""
    echo "🛑 Arrêt de l'application..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "🔧 Démarrage du Backend sur le port 3001..."
cd backend
npm run dev &
BACKEND_PID=$!

sleep 3

echo ""
echo "🎨 Démarrage du Frontend sur le port 3000..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Application démarrée !"
echo ""
echo "📱 Frontend : http://localhost:3000"
echo "🔧 Backend  : http://localhost:3001"
echo ""
echo "💡 Astuce : Sur GitHub Codespaces, cliquez sur 'Open in Browser' quand la notification apparaît"
echo ""
echo "⏹️  Pour arrêter : appuyez sur Ctrl+C"
echo ""

# Attendre que les processus soient terminés
wait
