# 🎯 GUIDE ULTRA-SIMPLE - DÉBUTANT

## Comment mettre SecureVault sur GitHub et le faire fonctionner

### ÉTAPE 1 : Créer le repository sur GitHub.com

1. Allez sur **https://github.com**
2. Cliquez sur le bouton **"+"** en haut à droite
3. Sélectionnez **"New repository"**
4. Donnez un nom : **securevault**
5. Description : **Service de partage de fichiers éphémères chiffrés - Projet M1 Cybersécurité**
6. Laissez **Public** (ou Private si vous préférez)
7. **NE COCHEZ PAS** "Add a README file"
8. Cliquez sur **"Create repository"**

### ÉTAPE 2 : Uploader les fichiers sur GitHub

Vous avez **2 OPTIONS** :

---

#### 🅰️ OPTION A : Upload via l'interface web (PLUS FACILE)

1. Sur la page de votre nouveau repository, cliquez sur **"uploading an existing file"**
2. **Téléchargez d'abord le ZIP** que je vous ai créé (lien ci-dessous)
3. **Décompressez le ZIP** sur votre PC
4. **Glissez-déposez** TOUS les fichiers et dossiers dans la zone d'upload
5. En bas, dans "Commit changes", écrivez : `Initial commit - SecureVault project`
6. Cliquez sur **"Commit changes"**

✅ **C'EST FAIT !** Votre code est sur GitHub !

---

#### 🅱️ OPTION B : Upload via GitHub Desktop (RECOMMANDÉ si vous voulez modifier le code plus tard)

1. Téléchargez **GitHub Desktop** : https://desktop.github.com/
2. Installez et connectez-vous avec votre compte GitHub
3. Dans GitHub Desktop :
   - Cliquez sur **"File" → "Clone repository"**
   - Sélectionnez votre repository **securevault**
   - Choisissez où le sauvegarder sur votre PC
   - Cliquez sur **"Clone"**
4. **Copiez** tous les fichiers du projet dans ce dossier
5. Dans GitHub Desktop, vous verrez tous les fichiers dans "Changes"
6. En bas à gauche, écrivez : `Initial commit`
7. Cliquez sur **"Commit to main"**
8. Cliquez sur **"Push origin"** en haut

✅ **C'EST FAIT !** Votre code est sur GitHub !

---

### ÉTAPE 3 : Faire fonctionner l'application (GitHub Codespaces - GRATUIT)

**GitHub Codespaces** = un ordinateur virtuel Linux dans votre navigateur (60 heures gratuites/mois)

1. Sur votre repository GitHub, cliquez sur le bouton vert **"Code"**
2. Sélectionnez l'onglet **"Codespaces"**
3. Cliquez sur **"Create codespace on main"**
4. **Attendez 2-3 minutes** que l'environnement se charge

### ÉTAPE 4 : Installer et démarrer

Une fois dans Codespaces, vous verrez un terminal en bas. Tapez ces commandes UNE PAR UNE :

```bash
# 1. Rendre les scripts exécutables
chmod +x setup.sh start.sh

# 2. Installer tout
./setup.sh

# 3. Démarrer l'application
./start.sh
```

### ÉTAPE 5 : Accéder à l'application

Après quelques secondes, une notification apparaîtra en bas à droite :

📱 **"Your application running on port 3000 is available"**

➡️ Cliquez sur **"Open in Browser"**

🎉 **VOILÀ !** Votre application fonctionne !

---

## 🎓 Pour la démonstration de votre projet

### Montrer l'upload d'un fichier :

1. Sélectionnez un fichier
2. Choisissez les options (1 téléchargement, 24h)
3. Cliquez sur "Chiffrer et partager"
4. **MONTREZ** dans les outils de développement (F12 → Network) que le fichier est chiffré AVANT l'envoi
5. Copiez le lien

### Montrer le téléchargement :

1. Ouvrez le lien dans un nouvel onglet privé
2. Cliquez sur "Télécharger le fichier"
3. Le fichier est déchiffré dans le navigateur
4. **MONTREZ** que si vous réessayez, le fichier est supprimé (erreur 410)

### Montrer la sécurité :

1. **Backend** : Montrez les fichiers dans `backend/uploads/` → ils sont chiffrés
2. **Base de données** : Montrez que seules les métadonnées sont stockées
3. **Pipeline** : Montrez le fichier `.github/workflows/security.yml`
4. **Logs** : Montrez les logs d'audit dans le terminal

---

## 🔧 Commandes utiles

```bash
# Voir les logs du backend
cd backend && npm run dev

# Voir les logs du frontend
cd frontend && npm start

# Nettoyer manuellement les fichiers expirés
node backend/src/utils/cleanup.js

# Arrêter l'application
# Appuyez sur Ctrl+C dans le terminal
```

---

## 📊 Voir le code

Tous les fichiers importants :

- **Architecture** : Ouvrez `Schema_Architecture_SecureVault.html` dans votre navigateur
- **Backend API** : `backend/src/server.js` et `backend/src/routes/index.js`
- **Chiffrement** : `frontend/src/utils/crypto.js`
- **Upload** : `backend/src/controllers/uploadController.js`
- **Download** : `backend/src/controllers/downloadController.js`
- **Base de données** : `backend/sql/schema.sql`
- **Sécurité** : `backend/src/middleware/security.js`

---

## ❓ Problèmes fréquents

**"Cannot connect to database"**
```bash
sudo service postgresql start
./setup.sh
```

**"Port 3000 already in use"**
```bash
# Arrêtez l'ancien processus
pkill -f "react-scripts"
./start.sh
```

**"Module not found"**
```bash
cd backend && npm install
cd ../frontend && npm install
```

---

## 🎯 Pour votre présentation

1. Montrez le **schéma d'architecture** (ouvrez le fichier HTML)
2. Faites une **démo live** de l'upload/download
3. Montrez le **code de chiffrement** dans crypto.js
4. Montrez les **logs de sécurité** dans le terminal
5. Montrez les **documents** (dans le dossier docs/)

---

## 📚 Documentation complète

Tous les documents Word sont dans le repository :

- 01_Description_Projet_Architecture.docx
- 02_Cahier_Charges_Securite.docx
- 03_Backlog_Securite.docx
- 04_Analyse_Risques_EBIOS.docx
- 05_Plan_Traitement_Risques.docx
- 06_Tableau_Bord_KPIs_KRIs.docx
- 07_Guide_DevSecOps.docx
- 08_Guide_Demonstration.docx

---

## 💡 Conseils pour le projet

- **Testez tout** avant la démo
- **Préparez un plan B** (vidéo de la démo)
- **Expliquez la sécurité** : AES-256, zero-knowledge, etc.
- **Montrez le pipeline DevSecOps** (GitHub Actions si configuré)
- **Soyez prêt** à expliquer chaque partie du code

---

## ✅ Checklist finale

- [ ] Code uploadé sur GitHub
- [ ] Application fonctionne dans Codespaces
- [ ] Démo d'upload testée
- [ ] Démo de download testée
- [ ] Documents Word téléchargés
- [ ] Schéma d'architecture visualisé
- [ ] Présentation préparée
- [ ] Plan B prêt

---

**🎉 Vous êtes prêt ! Bonne chance pour votre présentation ! 🚀**

*En cas de problème, consultez les fichiers de documentation ou demandez de l'aide.*
