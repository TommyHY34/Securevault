import React from 'react';
import Upload from './components/Upload';
import './styles/App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="logo">🔐</div>
        <h1>SecureVault</h1>
        <p className="tagline">Partage de fichiers éphémères chiffrés</p>
      </header>
      
      <main>
        <Upload />
      </main>
      
      <footer className="App-footer">
        <p>Projet Mastère 1 Expert en Cybersécurité - Février 2026</p>
        <p>Chiffrement AES-256-GCM • Zero-knowledge • Éphémère</p>
      </footer>
    </div>
  );
}

export default App;
