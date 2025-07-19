const ContentModel = require('../models/content-model');
const ContentViewModel = require('../models/content-view-model');
const ContentUtils = require('../utils/content-utils');
const ProxyService = require('./proxy-service');

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
            if (!ContentUtils.isValidStreamingUrl(preparedData.url_transmissao)) {
                throw new Error('URL de streaming inválida');
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
            if (!ContentUtils.isValidStreamingUrl(preparedData.url_transmissao)) {
                throw new Error('URL de streaming inválida');
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
     * Registrar visualização
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
     * Iniciar streaming de conteúdo (NOVA LÓGICA - SEM TORRENT)
     */
    static async startStreaming(contentId, viewData, ipAddress, userAgent, intent = 'watch') {
        // Obter detalhes do conteúdo
        const content = await this.getContentById(contentId);
        
        // Verificar se está pronto para streaming
        const readyCheck = ContentUtils.isReadyForStreaming(content);
        if (!readyCheck.ready) {
            throw new Error(readyCheck.reason);
        }

        let streamInfo = null;
        let viewRecord = null;
        let proxyInfo = null;

        try {
            // Tentar registrar visualização (não falhar se já existir)
            const forceNew = intent === 'rewatch';
            viewRecord = await this.recordView(contentId, viewData, ipAddress, userAgent, forceNew);
        } catch (viewError) {
            // Se falhar ao registrar view, continuar com streaming
            console.warn('View registration failed, continuing with streaming:', viewError.message);
        }

        try {
            // Verificar se precisa de proxy
            if (ContentUtils.requiresProxy(content.url_transmissao)) {
                // Criar proxy para URL HTTP
                proxyInfo = await ProxyService.createContentProxy(contentId, content.url_transmissao);
                
                streamInfo = {
                    type: 'proxy',
                    streaming_type: ContentUtils.detectStreamingType(content.url_transmissao),
                    proxyId: proxyInfo.proxyId,
                    streamUrl: proxyInfo.proxyUrl,
                    originalUrl: content.url_transmissao,
                    requiresAuth: proxyInfo.requiresAuth,
                    ready: true
                };
            } else {
                // Stream direto - URL já é HTTPS ou ambiente não requer proxy
                streamInfo = {
                    type: 'direct',
                    streaming_type: ContentUtils.detectStreamingType(content.url_transmissao),
                    url: content.url_transmissao,
                    ready: true
                };
            }
        } catch (streamError) {
            // Log erro mas não falhar completamente
            console.warn('Stream setup failed:', streamError.message);
            
            // Tentar stream direto como fallback
            streamInfo = {
                type: 'direct',
                streaming_type: ContentUtils.detectStreamingType(content.url_transmissao),
                url: content.url_transmissao,
                ready: true,
                warning: 'Proxy creation failed, using direct stream'
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
                streaming_type: ContentUtils.detectStreamingType(content.url_transmissao),
                episode_info: content.serie_info
            },
            view: viewRecord,
            streaming: streamInfo,
            proxy: proxyInfo,
            ready: streamInfo.ready
        };
    }

    /**
     * Obter status de streaming de um conteúdo
     */
    static async getStreamingStatus(contentId) {
        try {
            const content = await this.getContentById(contentId);
            
            const readyCheck = ContentUtils.isReadyForStreaming(content);
            if (!readyCheck.ready) {
                return {
                    status: 'error',
                    ready: false,
                    reason: readyCheck.reason
                };
            }

            const streamingType = ContentUtils.detectStreamingType(content.url_transmissao);
            const requiresProxy = ContentUtils.requiresProxy(content.url_transmissao);

            return {
                status: 'ready',
                ready: true,
                streaming_type: streamingType,
                requires_proxy: requiresProxy,
                content_type: content.streaming.type || 'progressive',
                url_available: !!content.url_transmissao
            };
        } catch (error) {
            return {
                status: 'error',
                ready: false,
                reason: error.message
            };
        }
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
            formatted_status: this.formatSeriesStatus(serie.status_serie),
            streaming_type: ContentUtils.detectStreamingType(serie.url_transmissao || '')
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

   /**
    * Testar conectividade de um conteúdo
    */
   static async testContentConnectivity(contentId) {
       try {
           const content = await this.getContentById(contentId);
           
           // Usar ProxyService para testar a URL
           const axios = require('axios');
           const startTime = Date.now();
           
           const response = await axios.head(content.url_transmissao, { 
               timeout: 10000,
               maxRedirects: 5
           });
           
           const responseTime = Date.now() - startTime;
           
           return {
               contentId,
               url: content.url_transmissao,
               status: 'success',
               statusCode: response.status,
               responseTime,
               contentType: response.headers['content-type'],
               contentLength: response.headers['content-length'],
               streaming_type: ContentUtils.detectStreamingType(content.url_transmissao),
               requires_proxy: ContentUtils.requiresProxy(content.url_transmissao)
           };
       } catch (error) {
           return {
               contentId,
               status: 'error',
               error: error.message,
               code: error.code
           };
       }
   }

   /**
    * Obter recomendações baseadas em visualizações
    */
   static async getRecommendations(userId, limit = 10) {
       // Implementação básica - pode ser expandida com algoritmos mais sofisticados
       const recentContents = await this.getRecentContents(limit);
       const popularContents = await this.getPopularContents(limit);
       
       // Misturar conteúdos recentes e populares
       const mixed = [...recentContents, ...popularContents];
       const unique = mixed.filter((content, index, self) => 
           index === self.findIndex(c => c.id === content.id)
       );
       
       return unique.slice(0, limit);
   }
}

module.exports = ContentService;