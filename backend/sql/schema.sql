-- Schéma de base de données SecureVault
-- PostgreSQL 13+

-- Table des fichiers partagés
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    
    -- Métadonnées d'expiration
    max_downloads INTEGER DEFAULT 1 CHECK (max_downloads > 0 AND max_downloads <= 100),
    download_count INTEGER DEFAULT 0 CHECK (download_count >= 0),
    expires_at TIMESTAMP,
    
    -- Métadonnées système
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    
    -- Statut
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    
    CONSTRAINT check_expiry CHECK (
        expires_at IS NULL OR expires_at > created_at
    ),
    CONSTRAINT check_download_count CHECK (
        download_count <= max_downloads
    )
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at) WHERE is_deleted = FALSE AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_files_download_count ON files(download_count, max_downloads) WHERE is_deleted = FALSE;

-- Table des logs d'accès
CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    file_id UUID REFERENCES files(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('upload', 'download', 'delete', 'view')),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_logs_file_id ON access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);

-- Vue pour les statistiques
CREATE OR REPLACE VIEW file_statistics AS
SELECT 
    DATE_TRUNC('day', created_at)::DATE as date,
    COUNT(*) as total_uploads,
    COUNT(*) FILTER (WHERE is_deleted = TRUE) as total_deleted,
    SUM(file_size) as total_size_bytes,
    ROUND(AVG(file_size)) as avg_size_bytes,
    AVG(download_count) as avg_downloads,
    MAX(file_size) as max_file_size
FROM files
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Vue pour les fichiers actifs
CREATE OR REPLACE VIEW active_files AS
SELECT 
    id,
    original_filename,
    file_size,
    download_count,
    max_downloads,
    expires_at,
    created_at,
    CASE 
        WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired_time'
        WHEN download_count >= max_downloads THEN 'expired_downloads'
        ELSE 'active'
    END as status
FROM files
WHERE is_deleted = FALSE;

-- Fonction pour nettoyer automatiquement les fichiers expirés
CREATE OR REPLACE FUNCTION cleanup_expired_files()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
    count INTEGER;
BEGIN
    WITH deleted AS (
        UPDATE files
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE is_deleted = FALSE
        AND (
            (expires_at IS NOT NULL AND expires_at < NOW())
            OR (download_count >= max_downloads)
        )
        RETURNING id
    )
    SELECT COUNT(*)::INTEGER INTO count FROM deleted;
    
    RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour documentation
COMMENT ON TABLE files IS 'Stocke les métadonnées des fichiers partagés (les fichiers réels sont sur le filesystem)';
COMMENT ON TABLE access_logs IS 'Logs d''audit de tous les accès aux fichiers';
COMMENT ON VIEW file_statistics IS 'Statistiques quotidiennes d''utilisation';
COMMENT ON VIEW active_files IS 'Vue des fichiers actuellement actifs avec leur statut';
COMMENT ON FUNCTION cleanup_expired_files IS 'Fonction pour marquer les fichiers expirés comme supprimés';

-- Insérer des données de test (optionnel, à commenter en production)
-- INSERT INTO files (filename, original_filename, file_size, mime_type, max_downloads, expires_at)
-- VALUES ('test-file-123.txt', 'document.txt', 1024, 'text/plain', 1, NOW() + INTERVAL '1 day');
