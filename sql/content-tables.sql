-- Tabela de conteúdos
CREATE TABLE contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    url_transmissao VARCHAR(500) NOT NULL,
    poster VARCHAR(500),
    categoria VARCHAR(50) NOT NULL,
    subcategoria VARCHAR(50) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    temporada INTEGER DEFAULT NULL,
    episodio INTEGER DEFAULT NULL,
    rating DECIMAL(3,1) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 10.0),
    total_visualizations INTEGER DEFAULT 0,
    qualidades JSONB DEFAULT '[]', -- Array de qualidades disponíveis
    metadata JSONB DEFAULT '{}', -- Dados adicionais (duração, descrição, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de visualizações (para tracking por IP)
CREATE TABLE content_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    view_duration INTEGER DEFAULT NULL, -- Em segundos
    view_percentage DECIMAL(5,2) DEFAULT NULL, -- % assistido
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX idx_contents_categoria ON contents(categoria);
CREATE INDEX idx_contents_subcategoria ON contents(subcategoria);
CREATE INDEX idx_contents_ativo ON contents(ativo);
CREATE INDEX idx_contents_rating ON contents(rating);
CREATE INDEX idx_contents_temporada_episodio ON contents(temporada, episodio);
CREATE INDEX idx_contents_created_at ON contents(created_at);
CREATE INDEX idx_contents_total_visualizations ON contents(total_visualizations);

CREATE INDEX idx_content_views_content_id ON content_views(content_id);
CREATE INDEX idx_content_views_ip_address ON content_views(ip_address);
CREATE INDEX idx_content_views_created_at ON content_views(created_at);
CREATE INDEX idx_content_views_user_profile ON content_views(user_id, profile_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_contents_updated_at 
    BEFORE UPDATE ON contents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar contador de visualizações
CREATE OR REPLACE FUNCTION update_content_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE contents 
    SET total_visualizations = total_visualizations + 1
    WHERE id = NEW.content_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar contador automaticamente
CREATE TRIGGER update_content_view_count_trigger
    AFTER INSERT ON content_views
    FOR EACH ROW EXECUTE FUNCTION update_content_view_count();