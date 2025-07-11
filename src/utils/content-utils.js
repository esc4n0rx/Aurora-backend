class ContentUtils {
    /**
     * Categorias disponíveis
     */
    static CATEGORIES = [
        'acao', 'aventura', 'comedia', 'drama', 'terror', 'ficcao_cientifica',
        'fantasia', 'romance', 'thriller', 'documentario', 'animacao', 'crime',
        'guerra', 'historia', 'musica', 'misterio', 'familia', 'biografia'
    ];

    /**
     * Subcategorias disponíveis
     */
    static SUBCATEGORIES = [
        'filme', 'serie', 'anime', 'desenho', 'documentario', 'curta',
        'minisserie', 'reality_show', 'talk_show', 'esporte'
    ];

    /**
     * Qualidades de vídeo disponíveis
     */
    static QUALITIES = [
        '480p', '720p', '1080p', '1440p', '4k', 'auto'
    ];

    /**
     * Validar categoria
     */
    static isValidCategory(category) {
        return this.CATEGORIES.includes(category);
    }

    /**
     * Validar subcategoria
     */
    static isValidSubcategory(subcategory) {
        return this.SUBCATEGORIES.includes(subcategory);
    }

    /**
     * Validar qualidades
     */
    static validateQualities(qualities) {
        if (!Array.isArray(qualities)) {
            return false;
        }
        
        return qualities.every(quality => this.QUALITIES.includes(quality));
    }

    /**
     * Verificar se conteúdo é série
     */
    static isSeries(subcategoria) {
        return ['serie', 'anime', 'minisserie'].includes(subcategoria);
    }

    /**
     * Formatar dados de conteúdo para resposta
     */
    static formatContentResponse(content) {
        return {
            ...content,
            is_series: this.isSeries(content.subcategoria),
            view_count: content.total_visualizations || 0
        };
    }

    /**
     * Validar URL de transmissão
     */
    static isValidStreamingUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return ['http:', 'https:', 'rtmp:', 'rtmps:'].includes(parsedUrl.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Sanitizar metadados
     */
    static sanitizeMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return {};
        }

        // Campos permitidos nos metadados
        const allowedFields = [
            'descricao', 'duracao', 'ano_lancamento', 'diretor', 'elenco',
            'generos_secundarios', 'idade_recomendada', 'idioma', 'legendas',
            'trailer_url', 'imdb_id', 'tmdb_id'
        ];

        const sanitized = {};
        for (const field of allowedFields) {
            if (metadata[field] !== undefined) {
                sanitized[field] = metadata[field];
            }
        }

        return sanitized;
    }
}

module.exports = ContentUtils;