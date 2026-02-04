import React, { useState } from 'react';

const Upload = () => {
  const [message, setMessage] = useState('Sélectionnez un fichier pour commencer');

  return (
    <div style={{
      background: 'white',
      padding: '3rem',
      borderRadius: '20px',
      maxWidth: '600px',
      textAlign: 'center'
    }}>
      <h2 style={{marginBottom: '2rem'}}>📤 Partager un fichier</h2>
      <p>{message}</p>
      <input 
        type="file" 
        onChange={(e) => setMessage(`Fichier: ${e.target.files[0]?.name || 'Aucun'}`)}
        style={{margin: '2rem 0', padding: '1rem'}}
      />
      <div style={{
        background: '#e3f2fd',
        padding: '1.5rem',
        borderRadius: '10px',
        marginTop: '2rem'
      }}>
        <p><strong>🔐 Sécurité:</strong></p>
        <p>Chiffrement AES-256-GCM côté client</p>
        <p>Zero-knowledge • Éphémère</p>
      </div>
    </div>
  );
};

export default Upload;
