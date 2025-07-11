-- Adicionar campos de gerenciamento na tabela users
ALTER TABLE users 
ADD COLUMN is_blocked BOOLEAN DEFAULT false,
ADD COLUMN blocked_reason TEXT DEFAULT NULL,
ADD COLUMN blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN is_deleted BOOLEAN DEFAULT false,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Índices para otimização
CREATE INDEX idx_users_is_blocked ON users(is_blocked);
CREATE INDEX idx_users_is_deleted ON users(is_deleted);
CREATE INDEX idx_users_blocked_at ON users(blocked_at);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- View para usuários ativos (não bloqueados e não deletados)
CREATE VIEW active_users AS
SELECT * FROM users 
WHERE is_blocked = false AND is_deleted = false;

-- View para usuários com estatísticas
CREATE VIEW users_with_stats AS
SELECT 
    u.*,
    COUNT(DISTINCT p.id) as profiles_count,
    COUNT(DISTINCT ua.id) as actions_count,
    MAX(ua.created_at) as last_activity
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id AND p.is_active = true
LEFT JOIN user_actions ua ON u.id = ua.user_id
GROUP BY u.id;