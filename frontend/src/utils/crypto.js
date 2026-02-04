/**
 * Module de chiffrement/déchiffrement AES-256-GCM
 * Utilise l'API Web Crypto native du navigateur
 */

/**
 * Génère une clé AES-256 aléatoire
 * @returns {Promise<CryptoKey>} Clé de chiffrement
 */
export const generateKey = async () => {
  try {
    const key = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    return key;
  } catch (error) {
    console.error('Erreur génération clé:', error);
    throw new Error('Impossible de générer la clé de chiffrement');
  }
};

/**
 * Exporte une clé en format base64
 * @param {CryptoKey} key - Clé à exporter
 * @returns {Promise<string>} Clé en base64
 */
export const exportKey = async (key) => {
  try {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return arrayBufferToBase64(exported);
  } catch (error) {
    console.error('Erreur export clé:', error);
    throw new Error('Impossible d\'exporter la clé');
  }
};

/**
 * Importe une clé depuis le format base64
 * @param {string} base64Key - Clé en base64
 * @returns {Promise<CryptoKey>} Clé importée
 */
export const importKey = async (base64Key) => {
  try {
    const keyData = base64ToArrayBuffer(base64Key);
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );
    return key;
  } catch (error) {
    console.error('Erreur import clé:', error);
    throw new Error('Clé de déchiffrement invalide');
  }
};

/**
 * Chiffre un fichier avec AES-256-GCM
 * @param {File} file - Fichier à chiffrer
 * @param {CryptoKey} key - Clé de chiffrement
 * @returns {Promise<Blob>} Fichier chiffré
 */
export const encryptFile = async (file, key) => {
  try {
    // Lire le fichier
    const fileData = await file.arrayBuffer();
    
    // Générer un IV (Initialization Vector) aléatoire de 12 bytes pour GCM
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Chiffrer les données
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // Authentification tag de 128 bits
      },
      key,
      fileData
    );
    
    // Combiner IV + données chiffrées
    // Format: [12 bytes IV][encrypted data]
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Créer un Blob
    return new Blob([combined], { type: 'application/octet-stream' });
    
  } catch (error) {
    console.error('Erreur chiffrement:', error);
    throw new Error('Impossible de chiffrer le fichier');
  }
};

/**
 * Déchiffre un fichier avec AES-256-GCM
 * @param {Blob} encryptedBlob - Fichier chiffré
 * @param {CryptoKey} key - Clé de déchiffrement
 * @returns {Promise<Blob>} Fichier déchiffré
 */
export const decryptFile = async (encryptedBlob, key) => {
  try {
    const data = await encryptedBlob.arrayBuffer();
    const dataView = new Uint8Array(data);
    
    // Extraire l'IV (12 premiers bytes)
    const iv = dataView.slice(0, 12);
    
    // Extraire les données chiffrées (reste du fichier)
    const encrypted = dataView.slice(12);
    
    // Déchiffrer
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128
      },
      key,
      encrypted
    );
    
    // Retourner le Blob déchiffré
    return new Blob([decrypted]);
    
  } catch (error) {
    console.error('Erreur déchiffrement:', error);
    
    // Erreurs spécifiques
    if (error.name === 'OperationError') {
      throw new Error('Clé de déchiffrement incorrecte ou fichier corrompu');
    }
    
    throw new Error('Impossible de déchiffrer le fichier');
  }
};

/**
 * Vérifie si le navigateur supporte l'API Web Crypto
 * @returns {boolean} true si supporté
 */
export const isWebCryptoSupported = () => {
  return !!(window.crypto && window.crypto.subtle);
};

/**
 * Convertit un ArrayBuffer en base64
 * @param {ArrayBuffer} buffer 
 * @returns {string}
 */
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * Convertit une chaîne base64 en ArrayBuffer
 * @param {string} base64 
 * @returns {ArrayBuffer}
 */
const base64ToArrayBuffer = (base64) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Formate la taille d'un fichier
 * @param {number} bytes 
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
