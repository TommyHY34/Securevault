# 🔐 SecureVault - Service de Partage de Fichiers Éphémères Chiffrés

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 📋 Description

SecureVault est un service de partage de fichiers éphémères avec chiffrement de bout en bout AES-256-GCM. Les fichiers sont chiffrés côté client avant l'envoi, garantissant que même le serveur ne peut pas accéder au contenu.

### ✨ Fonctionnalités

- 🔒 **Chiffrement AES-256-GCM** côté client
- 🔗 **Liens uniques** non prédictibles (UUID v4)
- ⏱️ **Expiration automatique** (par nombre de lectures ou durée)
- 🚫 **Zero-knowledge** : le serveur ne peut pas déchiffrer
- 🛡️ **Sécurité renforcée** : HTTPS, HSTS, CSP, Rate limiting
- 📊 **Pipeline DevSecOps** complet

## 🚀 DÉMARRAGE RAPIDE (GitHub Codespaces)

### Option 1 : Avec GitHub Codespaces (RECOMMANDÉ - Gratuit)

1. Cliquez sur le bouton vert **"Code"** en haut de cette page
2. Sélectionnez l'onglet **"Codespaces"**
3. Cliquez sur **"Create codespace on main"**
4. Attendez que l'environnement se charge (2-3 minutes)
5. Dans le terminal qui s'ouvre automatiquement :

```bash
# Installer les dépendances
./setup.sh

# Démarrer l'application
./start.sh
```

6. Une notification apparaîtra avec un bouton "Open in Browser" - cliquez dessus !

### Option 2 : Installation locale (Avancé)

Consultez [INSTALL.md](./INSTALL.md) pour l'installation locale.

## 📖 Documentation

- [Guide d'installation complet](./INSTALL.md)
- [Documentation technique](./docs/)
- [Guide de sécurité](./docs/02_Cahier_Charges_Securite.docx)
- [Architecture](./docs/01_Description_Projet_Architecture.docx)

## 🎯 Utilisation

### Upload d'un fichier

1. Ouvrez l'application dans votre navigateur
2. Sélectionnez un fichier
3. Choisissez les options d'expiration
4. Cliquez sur "Chiffrer et partager"
5. Copiez le lien généré

### Téléchargement d'un fichier

1. Ouvrez le lien reçu
2. Cliquez sur "Télécharger le fichier"
3. Le fichier est automatiquement déchiffré dans votre navigateur

## 🏗️ Architecture

```
┌─────────────┐
│  Frontend   │  React.js + Web Crypto API
│  (Client)   │  Chiffrement AES-256-GCM
└──────┬──────┘
       │ HTTPS/TLS 1.3
       ▼
┌─────────────┐
│   Nginx     │  Reverse Proxy + Rate Limiting
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Backend   │  Node.js/Express
│   API REST  │  
└──────┬──────┘
       │
       ├──────────┬──────────┐
       ▼          ▼          ▼
 ┌──────────┐ ┌────────┐ ┌────────┐
 │PostgreSQL│ │ Files  │ │ Logs   │
 │Metadata  │ │Encrypt.│ │        │
 └──────────┘ └────────┘ └────────┘
```

## 🔒 Sécurité

### Mesures implémentées

- ✅ Chiffrement AES-256-GCM côté client
- ✅ HTTPS obligatoire (TLS 1.3)
- ✅ Headers de sécurité HTTP (HSTS, CSP, X-Frame-Options)
- ✅ Rate limiting (10 req/min par IP)
- ✅ Validation stricte des entrées
- ✅ Protection CSRF
- ✅ Protection injection SQL (requêtes préparées)
- ✅ Logs d'audit
- ✅ Suppression sécurisée des fichiers
- ✅ UUID non prédictibles

### Pipeline DevSecOps

- `npm audit` - Scan des dépendances
- `ESLint Security Plugin` - Analyse statique
- `Trivy` - Scan des conteneurs Docker
- Tests automatisés

## 🛠️ Stack Technique

### Frontend
- React.js 18
- Web Crypto API (chiffrement)
- Axios (requêtes HTTP)
- React Router

### Backend
- Node.js 18+
- Express.js
- PostgreSQL
- Sequelize ORM
- Multer (upload)
- Helmet (sécurité)

### DevOps
- Docker & Docker Compose
- GitHub Actions (CI/CD)
- Nginx (reverse proxy)

## 📊 Métriques

- **Max file size**: 50 MB
- **Default expiry**: 24 hours
- **Default max downloads**: 1
- **Cleanup interval**: 1 hour

## 🤝 Contribution

Ce projet est un projet académique pour le Mastère 1 Expert en Cybersécurité.

## 📝 License

MIT License - voir [LICENSE](./LICENSE)

## 👨‍💻 Auteur

Projet réalisé dans le cadre du Mastère 1 Expert en Cybersécurité - Février 2026

## 📞 Support

Pour toute question, consultez la documentation dans le dossier `docs/`.

---

⭐ **N'oubliez pas de star le projet si vous le trouvez utile !**
