const ContentModel = require('../models/content-model');
const ContentViewModel = require('../models/content-view-model');
const ContentUtils = require('../utils/content-utils');
const TorrentUtils = require('../utils/torrent-utils');

class ContentService {
    /**
     * Criar novo conteúdo
     */
    static async createContent(contentData) {
        // Preparar dados para o banco
        const preparedData = ContentUtils.prepareDataForDatabase(contentData);

        // Validar consistência para episódios
        if (ContentUtils.isSeries(preparedData.subcategoria)) {
            const validationErrors = ContentUtils.validateEpisodeConsistency(preparedData);
            if (validationErrors.length > 0) {
                throw new Error(`Dados inconsistentes: ${validationErrors.join(', ')}`);
            }

            // Verificar se episódio já existe
            if (preparedData.temporada && preparedData.episodio) {
                const exists = await ContentModel.episodeExists(
                    preparedData.nome, 
                    preparedData.temporada, 
                    preparedData.episodio
                );
                
                if (exists) {
                    throw new Error(`Episódio ${preparedData.temporada}x${preparedData.episodio} da série "${preparedData.nome}" já existe`);
                }
            }
        }

        // Validar URL de transmissão
        if (preparedData.url_transmissao) {
            if (TorrentUtils.isMagnetLink(preparedData.url_transmissao)) {
                const hash = TorrentUtils.extractHashFromMagnet(preparedData.url_transmissao);
                if (!hash) {
                    throw new Error('Magnet link inválido - hash não encontrado');
                }
            }
        }

        const content = await ContentModel.create(preparedData);
        return ContentUtils.formatContentResponse(content);
    }

    /**
     * Obter conteúdo por ID
     */
    static async getContentById(id) {
        const content = await ContentModel.findById(id);
        
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        return ContentUtils.formatContentResponse(content);
    }

    /**
     * Listar conteúdos com filtros
     */
    static async listContents(filters) {
        const result = await ContentModel.findMany(filters);
        
        return {
            ...result,
            data: result.data.map(content => ContentUtils.formatContentResponse(content))
        };
    }

    /**
     * Atualizar conteúdo
     */
    static async updateContent(id, updateData) {
        // Verificar se conteúdo existe
        const existingContent = await ContentModel.findById(id);
        if (!existingContent) {
            throw new Error('Conteúdo não encontrado');
        }

        // Preparar dados para atualização
        const preparedData = ContentUtils.prepareDataForDatabase(updateData);

        // Validar consistência se estiver atualizando campos de série
        if (preparedData.subcategoria || preparedData.temporada || preparedData.episodio) {
            const mergedData = { ...existingContent, ...preparedData };
            
            if (ContentUtils.isSeries(mergedData.subcategoria)) {
                const validationErrors = ContentUtils.validateEpisodeConsistency(mergedData);
                if (validationErrors.length > 0) {
                    throw new Error(`Dados inconsistentes: ${validationErrors.join(', ')}`);
                }

                // Verificar conflito de episódio apenas se os dados de episódio mudaram
                if ((preparedData.temporada && preparedData.temporada !== existingContent.temporada) ||
                    (preparedData.episodio && preparedData.episodio !== existingContent.episodio) ||
                    (preparedData.nome && preparedData.nome !== existingContent.nome)) {
                    
                    const exists = await ContentModel.episodeExists(
                        mergedData.nome,
                        mergedData.temporada,
                        mergedData.episodio
                    );
                    
                    if (exists) {
                        throw new Error(`Episódio ${mergedData.temporada}x${mergedData.episodio} da série "${mergedData.nome}" já existe`);
                    }
                }
            }
        }

        // Validar URL de transmissão se fornecida
        if (preparedData.url_transmissao) {
            if (TorrentUtils.isMagnetLink(preparedData.url_transmissao)) {
                const hash = TorrentUtils.extractHashFromMagnet(preparedData.url_transmissao);
                if (!hash) {
                    throw new Error('Magnet link inválido - hash não encontrado');
                }
            }
        }

        const content = await ContentModel.update(id, preparedData);
        return ContentUtils.formatContentResponse(content);
    }

    /**
     * Excluir conteúdo
     */
    static async deleteContent(id) {
        // Verificar se conteúdo existe
        const existingContent = await ContentModel.findById(id);
        if (!existingContent) {
            throw new Error('Conteúdo não encontrado');
        }

        await ContentModel.delete(id);
        return { message: 'Conteúdo excluído com sucesso' };
    }

    /**
     * Registrar visualização (mantendo lógica anterior)
     */
    static async recordView(contentId, viewData, ipAddress, userAgent, forceNew = false) {
        // Verificar se conteúdo existe e está ativo
        const content = await ContentModel.findById(contentId);
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        if (!content.ativo) {
            throw new Error('Conteúdo não está ativo');
        }

        // Verificar se IP já visualizou recentemente (apenas se não forçar nova view)
        if (!forceNew) {
            const hasRecentView = await ContentViewModel.hasRecentView(contentId, ipAddress, 10);
            if (hasRecentView) {
                return {
                    id: 'existing_view',
                    content_id: contentId,
                    ip_address: ipAddress,
                    created_at: new Date().toISOString(),
                    message: 'Visualização já registrada recentemente',
                    is_existing: true
                };
            }
        }

        // Registrar nova visualização
        const viewRecord = await ContentViewModel.create({
            content_id: contentId,
            user_id: viewData.user_id || null,
            profile_id: viewData.profile_id || null,
            ip_address: ipAddress,
            user_agent: userAgent,
            view_duration: viewData.view_duration || null,
            view_percentage: viewData.view_percentage || null
        });

        return {
            ...viewRecord,
            is_existing: false
        };
    }

    /**
     * Obter conteúdos populares
     */
    static async getPopularContents(limit = 10) {
        const contents = await ContentModel.findPopular(limit);
        return contents.map(content => ContentUtils.formatContentResponse(content));
    }

    /**
     * Obter episódios de uma série (com formatação específica)
     */
    static async getSeriesEpisodes(seriesName, season = null) {
        const episodes = await ContentModel.findEpisodesBySeries(seriesName, season);
        
        if (!episodes.length) {
            return {
                series_name: seriesName,
                season: season,
                episodes: [],
                seasons_grouped: [],
                series_stats: null
            };
        }

        const formattedEpisodes = episodes.map(episode => ContentUtils.formatEpisodeResponse(episode));
        const seasonsGrouped = ContentUtils.groupEpisodesBySeason(episodes);
        const seriesStats = ContentUtils.generateSeriesStats(episodes);

        return {
            series_name: seriesName,
            season: season,
            episodes: formattedEpisodes,
            seasons_grouped: seasonsGrouped,
            series_stats: seriesStats
        };
    }

    /**
     * Obter todas as séries disponíveis
     */
    static async getAllSeries() {
        const series = await ContentModel.findAllSeries();
        
        return series.map(serie => ({
            ...serie,
            has_tmdb_data: !!serie.tmdb_hit,
            formatted_status: this.formatSeriesStatus(serie.status_serie)
        }));
    }

    /**
     * Obter temporadas de uma série
     */
    static async getSeriesSeasons(seriesName) {
        const seasons = await ContentModel.findSeasonsBySeries(seriesName);
        
        return seasons.map(season => ({
            season_number: season.temporada,
            season_description: season.descricao_temporada,
            episodes_count: parseInt(season.episodios_count),
            display_name: `Temporada ${season.temporada}`
        }));
    }

    /**
     * Obter navegação de episódios (anterior/próximo)
     */
    static async getEpisodeNavigation(contentId) {
        const content = await ContentModel.findById(contentId);
        
        if (!content || !ContentUtils.isSeries(content.subcategoria)) {
            return null;
        }

        const [previousEpisode, nextEpisode] = await Promise.all([
            ContentModel.findPreviousEpisode(content.nome, content.temporada, content.episodio),
            ContentModel.findNextEpisode(content.nome, content.temporada, content.episodio)
        ]);

        return {
            current: ContentUtils.formatEpisodeResponse(content),
            previous: previousEpisode ? ContentUtils.formatEpisodeResponse(previousEpisode) : null,
            next: nextEpisode ? ContentUtils.formatEpisodeResponse(nextEpisode) : null
        };
    }

    /**
     * Obter conteúdos relacionados
     */
    static async getRelatedContents(contentId, limit = 5) {
        const relatedContents = await ContentModel.findRelated(contentId, limit);
        return relatedContents.map(content => ContentUtils.formatContentResponse(content));
    }

    /**
     * Obter estatísticas gerais
     */
    static async getContentStats() {
        return await ContentModel.getStats();
    }

    /**
     * Obter estatísticas de visualização de um conteúdo
     */
    static async getContentViewStats(contentId, timeRange = '7d') {
        // Verificar se conteúdo existe
        const content = await ContentModel.findById(contentId);
        if (!content) {
            throw new Error('Conteúdo não encontrado');
        }

        const viewStats = await ContentViewModel.getViewStats(contentId, timeRange);
        const uniqueViews = await ContentViewModel.getUniqueViews(contentId);

        return {
            content: ContentUtils.formatContentResponse(content),
            viewStats,
            uniqueViewsCount: uniqueViews.length,
            totalViews: content.total_visualizations
        };
    }

    /**
     * Buscar conteúdos por TMDB
     */
    static async getContentsByTmdb(tmdbSerieId, tmdbTemporadaId = null, tmdbEpisodioId = null) {
        const contents = await ContentModel.findByTmdbId(tmdbSerieId, tmdbTemporadaId, tmdbEpisodioId);
        return contents.map(content => ContentUtils.formatContentResponse(content));
    }

    /**
     * Iniciar streaming de conteúdo (mantendo lógica anterior)
     */
    static async startStreaming(contentId, viewData, ipAddress, userAgent, intent = 'watch') {
        // Obter detalhes do conteúdo
        const content = await this.getContentById(contentId);
        
        if (!content.ativo) {
            throw new Error('Conteúdo não está ativo');
        }

        let streamInfo = null;
        let viewRecord = null;

        try {
            // Tentar registrar visualização (não falhar se já existir)
            const forceNew = intent === 'rewatch';
            viewRecord = await this.recordView(contentId, viewData, ipAddress, userAgent, forceNew);
        } catch (viewError) {
            // Se falhar ao registrar view, continuar com streaming
            console.warn('View registration failed, continuing with streaming:', viewError.message);
        }

        // Se for torrent, preparar stream
        if (TorrentUtils.isMagnetLink(content.url_transmissao)) {
            const torrentService = require('./torrent-service');
            
            try {
                const streamData = await torrentService.startTorrentStream(content.url_transmissao);
                streamInfo = {
                    type: 'torrent',
                    streamId: streamData.streamId,
                    streamUrl: `/api/v1/stream/${streamData.streamId}/video`,
                    statusUrl: `/api/v1/stream/content/${contentId}/status`,
                    filename: streamData.filename,
                    fileSize: streamData.fileSize,
                    progress: streamData.progress || 0
                };
            } catch (torrentError) {
                // Log erro mas não falhar
                console.warn('Torrent stream start failed:', torrentError.message);
                streamInfo = {
                    type: 'torrent',
                    status: 'failed',
                    error: torrentError.message,
                    retry: true
                };
            }
        } else {
            // Stream direto
            streamInfo = {
                type: 'direct',
                url: content.url_transmissao,
                ready: true
            };
        }

        return {
            content: {
                id: content.id,
                nome: content.nome,
                categoria: content.categoria,
                subcategoria: content.subcategoria,
                poster: content.poster,
                backdrop: content.backdrop,
                isTorrent: TorrentUtils.isMagnetLink(content.url_transmissao),
                episode_info: content.serie_info
            },
            view: viewRecord,
            streaming: streamInfo,
            ready: streamInfo.type === 'direct' || streamInfo.status !== 'failed'
        };
    }

    /**
     * Formatar status de série
     */
    static formatSeriesStatus(status) {
        const statusMap = {
            'em_andamento': 'Em Andamento',
            'finalizada': 'Finalizada',
            'cancelada': 'Cancelada',
            'pausada': 'Pausada'
        };
        
        return statusMap[status] || status;
    }

    /**
     * Obter conteúdos recentes
     */
    static async getRecentContents(limit = 10) {
        const contents = await ContentModel.findRecent(limit);
        return contents.map(content => ContentUtils.formatContentResponse(content));
    }

    /**
     * Obter conteúdos por faixa de rating
     */
    static async getContentsByRating(minRating, maxRating, limit = 20) {
        const contents = await ContentModel.findByRatingRange(minRating, maxRating, limit);
        return contents.map(content => ContentUtils.formatContentResponse(content));
    }
}

module.exports = ContentService;