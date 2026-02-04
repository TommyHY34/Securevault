#!/bin/bash

echo "🚀 Installation de SecureVault..."
echo "=================================="

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    echo "📥 Installation de Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Vérifier PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL n'est pas installé"
    echo "📥 Installation de PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    sudo service postgresql start
fi

echo ""
echo "📦 Installation des dépendances Backend..."
cd backend
npm install
echo "✅ Backend OK"

echo ""
echo "📦 Installation des dépendances Frontend..."
cd ../frontend
npm install
echo "✅ Frontend OK"

cd ..

echo ""
echo "🗄️ Configuration de la base de données..."
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS securevault;
DROP USER IF EXISTS securevault_user;
CREATE DATABASE securevault;
CREATE USER securevault_user WITH PASSWORD 'SecureVault2026!';
GRANT ALL PRIVILEGES ON DATABASE securevault TO securevault_user;
\c securevault
GRANT ALL ON SCHEMA public TO securevault_user;
EOF

echo "📊 Création des tables..."
sudo -u postgres psql -d securevault -f backend/sql/schema.sql

echo ""
echo "📁 Création des dossiers nécessaires..."
mkdir -p backend/uploads/temp
mkdir -p backend/logs

echo ""
echo "✅ Installation terminée !"
echo ""
echo "🎯 Pour démarrer l'application, exécutez :"
echo "   ./start.sh"
