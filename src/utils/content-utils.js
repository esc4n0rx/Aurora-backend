const TorrentUtils = require('./torrent-utils');

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
        const formatted = {
            ...content,
            is_series: this.isSeries(content.subcategoria),
            view_count: content.total_visualizations || 0,
            is_torrent: TorrentUtils.isMagnetLink(content.url_transmissao),
            has_backdrop: !!content.backdrop,
            has_poster: !!content.poster
        };

        // Adicionar informações de streaming se for torrent
        if (formatted.is_torrent) {
            formatted.stream_id = TorrentUtils.generateStreamId(content.url_transmissao);
            formatted.torrent_hash = TorrentUtils.extractHashFromMagnet(content.url_transmissao);
            formatted.streaming = {
                type: 'torrent',
                startUrl: `/api/v1/stream/content/${content.id}/start`,
                statusUrl: `/api/v1/stream/content/${content.id}/status`,
                playUrl: `/api/v1/stream/content/${content.id}/play`
            };
        } else {
            formatted.streaming = {
                type: 'direct',
                url: content.url_transmissao
            };
        }

        return formatted;
    }

    /**
     * Validar URL de transmissão
     */
    static isValidStreamingUrl(url) {
        // Aceitar magnet links
        if (TorrentUtils.isMagnetLink(url)) {
            return TorrentUtils.extractHashFromMagnet(url) !== null;
        }

        // Validar URLs HTTP/HTTPS normais
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
            'trailer_url', 'imdb_id', 'tmdb_id', 'sinopse', 'estudio',
            'pais_origem', 'orcamento', 'bilheteria'
        ];

        const sanitized = {};
        for (const field of allowedFields) {
            if (metadata[field] !== undefined) {
                sanitized[field] = metadata[field];
            }
        }

        return sanitized;
    }

    /**
     * Validar URLs de imagem (poster/backdrop)
     */
    static isValidImageUrl(url) {
        if (!url) return true; // Opcional
        
        try {
            const parsedUrl = new URL(url);
            
            // Verificar protocolo
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return false;
            }
            
            // Verificar extensão
            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
            const pathname = parsedUrl.pathname.toLowerCase();
            
            return validExtensions.some(ext => pathname.endsWith(ext)) ||
                   pathname.includes('/image/') ||  // Para serviços como TMDB
                   pathname.includes('/img/');      // Para CDNs
        } catch {
            return false;
        }
    }

    /**
     * Gerar URLs otimizadas de imagem
     */
    static generateImageUrls(originalUrl, sizes = ['w300', 'w500', 'w780', 'original']) {
        if (!originalUrl) return null;
        
        // Se for TMDB, gerar diferentes tamanhos
        if (originalUrl.includes('image.tmdb.org')) {
            const baseUrl = 'https://image.tmdb.org/t/p/';
            const imagePath = originalUrl.split('/t/p/')[1]?.split('/').slice(1).join('/');
            
            if (imagePath) {
                return sizes.reduce((acc, size) => {
                    acc[size] = `${baseUrl}${size}/${imagePath}`;
                    return acc;
                }, {});
            }
        }
        
        // Para outras URLs, retornar apenas a original
        return {
            original: originalUrl
        };
    }

    /**
     * Otimizar metadados para resposta
     */
    static optimizeMetadataForResponse(metadata) {
        if (!metadata) return {};
        
        const optimized = { ...metadata };
        
        // Adicionar campos calculados
        if (optimized.duracao) {
            optimized.duracao_formatada = this.formatDuration(optimized.duracao);
        }
        
        if (optimized.orcamento || optimized.bilheteria) {
            optimized.financeiro = {
                orcamento: optimized.orcamento,
                bilheteria: optimized.bilheteria,
                lucro: optimized.bilheteria && optimized.orcamento ? 
                       optimized.bilheteria - optimized.orcamento : null
            };
        }
        
        return optimized;
    }

    /**
     * Formatar duração em minutos para formato legível
     */
    static formatDuration(minutes) {
        if (!minutes || minutes <= 0) return null;
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${mins}min`;
        }
        
        return `${mins}min`;
    }
}

module.exports = ContentUtils;