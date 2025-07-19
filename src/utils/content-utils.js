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
     * Status de série disponíveis
     */
    static SERIE_STATUS = [
        'em_andamento', 'finalizada', 'cancelada', 'pausada'
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
     * Validar status de série
     */
    static isValidSerieStatus(status) {
        return this.SERIE_STATUS.includes(status);
    }

    /**
     * Formatar dados de conteúdo para resposta
     */
    static formatContentResponse(content) {
        const isSeries = this.isSeries(content.subcategoria);
        
        const formatted = {
            ...content,
            is_series: isSeries,
            view_count: content.total_visualizations || 0,
            is_torrent: TorrentUtils.isMagnetLink(content.url_transmissao),
            has_backdrop: !!content.backdrop,
            has_poster: !!content.poster,
            has_tmdb_data: !!content.tmdb_hit,
            
            // Informações específicas de série
            serie_info: isSeries ? {
                nome_serie: content.nome,
                descricao_serie: content.descricao_serie,
                status_serie: content.status_serie,
                temporadas_total: content.temporadas_total,
                episodios_total: content.episodios_total,
                temporada_atual: content.temporada,
                episodio_atual: content.episodio,
                nome_episodio: content.nome_episodio,
                descricao_temporada: content.descricao_temporada,
                descricao_episodio: content.descricao_episodio
            } : null,
            
            // Informações TMDB
            tmdb_info: content.tmdb_hit ? {
                serie_id: content.tmdb_serie_id,
                temporada_id: content.tmdb_temporada_id,
                episodio_id: content.tmdb_episodio_id,
                has_serie_data: !!content.tmdb_serie_id,
                has_temporada_data: !!content.tmdb_temporada_id,
                has_episodio_data: !!content.tmdb_episodio_id
            } : null
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
     * Formatar resposta específica para episódio de série
     */
    static formatEpisodeResponse(episode) {
        const formatted = this.formatContentResponse(episode);
        
        return {
            ...formatted,
            episode_display: {
                title: `${episode.nome} - S${episode.temporada?.toString().padStart(2, '0')}E${episode.episodio?.toString().padStart(2, '0')}`,
                episode_title: episode.nome_episodio || `Episódio ${episode.episodio}`,
                season_episode: `S${episode.temporada?.toString().padStart(2, '0')}E${episode.episodio?.toString().padStart(2, '0')}`,
                full_description: this.buildEpisodeDescription(episode)
            }
        };
    }

    /**
     * Construir descrição completa do episódio
     */
    static buildEpisodeDescription(episode) {
        const parts = [];
        
        if (episode.descricao_serie) {
            parts.push(`Série: ${episode.descricao_serie}`);
        }
        
        if (episode.descricao_temporada) {
            parts.push(`Temporada ${episode.temporada}: ${episode.descricao_temporada}`);
        }
        
        if (episode.descricao_episodio) {
            parts.push(`Episódio: ${episode.descricao_episodio}`);
        }
        
        return parts.join('\n\n');
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
            'pais_origem', 'orcamento', 'bilheteria', 'produtores', 'roteiristas',
            'premios', 'trilha_sonora', 'locacao_filmagem'
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
     * Preparar dados para inserção no banco
     */
    static prepareDataForDatabase(contentData) {
        const prepared = { ...contentData };
        
        // Sanitizar metadados
        if (prepared.metadata) {
            prepared.metadata = this.sanitizeMetadata(prepared.metadata);
        }
        
        // Garantir valores padrão para campos opcionais
        if (prepared.qualidades && !Array.isArray(prepared.qualidades)) {
            prepared.qualidades = ['auto'];
        }
        
        // Limpar campos TMDB se tmdb_hit for false
        if (!prepared.tmdb_hit) {
            prepared.tmdb_serie_id = null;
            prepared.tmdb_temporada_id = null;
            prepared.tmdb_episodio_id = null;
        }
        
        return prepared;
    }

    /**
     * Agrupar episódios por temporada
     */
    static groupEpisodesBySeason(episodes) {
        const grouped = {};
        
        episodes.forEach(episode => {
            const season = episode.temporada || 0;
            
            if (!grouped[season]) {
                grouped[season] = {
                    season_number: season,
                    season_description: episode.descricao_temporada,
                    episodes: []
                };
            }
            
            grouped[season].episodes.push(this.formatEpisodeResponse(episode));
        });
        
        // Converter para array e ordenar
        return Object.values(grouped).sort((a, b) => a.season_number - b.season_number);
    }

    /**
     * Gerar dados de estatísticas de série
     */
    static generateSeriesStats(episodes) {
        if (!episodes.length) return null;
        
        const firstEpisode = episodes[0];
        const seasons = new Set(episodes.map(ep => ep.temporada).filter(Boolean));
        const totalEpisodes = episodes.length;
        const avgRating = episodes.reduce((sum, ep) => sum + (ep.rating || 0), 0) / totalEpisodes;
        const totalViews = episodes.reduce((sum, ep) => sum + (ep.total_visualizations || 0), 0);
        
        return {
            serie_name: firstEpisode.nome,
            total_seasons: seasons.size,
            total_episodes: totalEpisodes,
            average_rating: Math.round(avgRating * 10) / 10,
            total_views: totalViews,
            status: firstEpisode.status_serie,
            latest_season: Math.max(...seasons),
            has_tmdb_data: !!firstEpisode.tmdb_hit,
            tmdb_serie_id: firstEpisode.tmdb_serie_id
        };
    }

    /**
     * Validar consistência de dados de episódio
     */
    static validateEpisodeConsistency(episodeData) {
        const errors = [];
        
        // Se é série, deve ter temporada e episódio
        if (this.isSeries(episodeData.subcategoria)) {
            if (!episodeData.temporada) {
                errors.push('Temporada é obrigatória para séries');
            }
            if (!episodeData.episodio) {
                errors.push('Número do episódio é obrigatório para séries');
            }
        }
        
        // Se tem dados TMDB de episódio, deve ter série
        if (episodeData.tmdb_episodio_id && !episodeData.tmdb_serie_id) {
            errors.push('ID da série no TMDB é obrigatório quando há ID de episódio');
        }
        
        // Se tem total de episódios, deve ser maior que o episódio atual
        if (episodeData.episodios_total && episodeData.episodio && 
            episodeData.episodio > episodeData.episodios_total) {
            errors.push('Número do episódio não pode ser maior que o total de episódios');
        }
        
        return errors;
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