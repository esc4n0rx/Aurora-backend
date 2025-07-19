const ContentService = require('../services/content-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');
const ContentUtils = require('../utils/content-utils');

class ContentController {
    /**
     * Criar novo conteúdo
     */
    static async createContent(req, res, next) {
        try {
            const content = await ContentService.createContent(req.body);
            
            // Log da criação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_CREATE,
                description: 'New content created',
                metadata: {
                    contentId: content.id,
                    contentName: content.nome,
                    categoria: content.categoria,
                    subcategoria: content.subcategoria,
                    isSeries: content.is_series,
                    streamingType: content.streaming_type,
                    requiresProxy: content.streaming.requires_proxy
                },
                request: req,
                statusCode: 201
            });
            
            res.status(201).json({
                success: true,
                message: 'Conteúdo criado com sucesso',
                data: content
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_CREATE,
                description: 'Content creation failed',
                metadata: {
                    contentName: req.body.nome,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            next(error);
        }
    }

    /**
     * Listar conteúdos
     */
    static async listContents(req, res, next) {
        try {
            const result = await ContentService.listContents(req.query);
            
            // Log da listagem
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_LIST,
                description: 'Contents listed',
                metadata: {
                    filters: req.query,
                    totalResults: result.total,
                    returnedCount: result.data.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Conteúdos obtidos com sucesso',
                data: result.data,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.offset + result.limit < result.total
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter conteúdo por ID
     */
    static async getContentById(req, res, next) {
        try {
            const { contentId } = req.params;
            const content = await ContentService.getContentById(contentId);
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_ACCESS,
                description: 'Content accessed',
                metadata: {
                    contentId: content.id,
                    contentName: content.nome,
                    categoria: content.categoria,
                    streamingType: content.streaming_type,
                    requiresProxy: content.streaming.requires_proxy
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Conteúdo obtido com sucesso',
                data: content
            });
        } catch (error) {
            if (error.message.includes('não encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Atualizar conteúdo
     */
    static async updateContent(req, res, next) {
        try {
            const { contentId } = req.params;
            const content = await ContentService.updateContent(contentId, req.body);
            
            // Log da atualização
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_UPDATE,
                description: 'Content updated',
                metadata: {
                    contentId: content.id,
                    contentName: content.nome,
                    updatedFields: Object.keys(req.body),
                    streamingType: content.streaming_type
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Conteúdo atualizado com sucesso',
                data: content
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_UPDATE,
                description: 'Content update failed',
                metadata: {
                    contentId: req.params.contentId,
                    updatedFields: Object.keys(req.body),
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Excluir conteúdo
     */
    static async deleteContent(req, res, next) {
        try {
            const { contentId } = req.params;
            const result = await ContentService.deleteContent(contentId);
            
            // Log da exclusão
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_DELETE,
                description: 'Content deleted',
                metadata: {
                    contentId
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_DELETE,
                description: 'Content deletion failed',
                metadata: {
                    contentId: req.params.contentId,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Registrar visualização de conteúdo (ATUALIZADA - SEM TORRENT)
     */
    static async recordView(req, res, next) {
        try {
            const { contentId } = req.params;
            const { intent = 'watch' } = req.body;
            const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            
            // Usar serviço atualizado sem torrent
            const result = await ContentService.startStreaming(
                contentId, 
                req.body, 
                ipAddress, 
                userAgent, 
                intent
            );
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.body.user_id || null,
                profileId: req.body.profile_id || null,
                actionType: ACTION_TYPES.CONTENT_VIEW,
                description: `Content streaming started - ${intent}`,
                metadata: {
                    contentId,
                    contentName: result.content.nome,
                    intent,
                    streamType: result.streaming.type,
                    streamingType: result.content.streaming_type,
                    viewRegistered: !!result.view && !result.view.is_existing,
                    isRewatch: intent === 'rewatch',
                    requiresProxy: result.streaming.type === 'proxy'
                },
                request: req,
                statusCode: 200
            });
            
            // Resposta baseada no tipo de stream
            if (result.streaming.type === 'direct') {
                res.json({
                    success: true,
                    message: 'Streaming direto disponível',
                    data: {
                        type: 'direct',
                        streaming_type: result.streaming.streaming_type,
                        streamUrl: result.streaming.url,
                        content: result.content,
                        view: result.view,
                        ready: true
                    }
                });
            } else if (result.streaming.type === 'proxy') {
                res.json({
                    success: true,
                    message: 'Streaming via proxy disponível',
                    data: {
                        type: 'proxy',
                        streaming_type: result.streaming.streaming_type,
                        proxyId: result.streaming.proxyId,
                        streamUrl: result.streaming.streamUrl,
                        originalUrl: result.streaming.originalUrl,
                        content: result.content,
                        view: result.view,
                        proxy: result.proxy,
                        ready: true
                    }
                });
            } else {
                // Fallback para erro
                res.status(500).json({
                    success: false,
                    message: 'Erro ao configurar streaming',
                    data: {
                        content: result.content,
                        error: 'Tipo de streaming não reconhecido'
                    }
                });
            }
            
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.body.user_id || null,
                actionType: ACTION_TYPES.CONTENT_VIEW,
                description: 'Content streaming failed',
                metadata: {
                    contentId: req.params.contentId,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado') || 
                error.message.includes('não está ativo')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Obter status de streaming do conteúdo
     */
    static async getStreamingStatus(req, res, next) {
        try {
            const { contentId } = req.params;
            
            const status = await ContentService.getStreamingStatus(contentId);
            
            res.json({
                success: status.ready,
                message: status.ready ? 'Conteúdo pronto para streaming' : 'Conteúdo não disponível para streaming',
                data: status
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter conteúdos populares
     */
    static async getPopularContents(req, res, next) {
        try {
            const { limit = 10 } = req.query;
            const contents = await ContentService.getPopularContents(parseInt(limit));
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CONTENT_POPULAR,
                description: 'Popular contents accessed',
                metadata: {
                    limit: parseInt(limit),
                    contentsCount: contents.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Conteúdos populares obtidos com sucesso',
                data: contents
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter episódios de uma série
     */
    static async getSeriesEpisodes(req, res, next) {
        try {
            const { seriesName } = req.params;
            const { season } = req.query;
            
            const episodes = await ContentService.getSeriesEpisodes(
                seriesName, 
                season ? parseInt(season) : null
            );
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.SERIES_EPISODES,
                description: 'Series episodes accessed',
                metadata: {
                    seriesName,
                    season: season || 'all',
                    episodesCount: episodes.episodes.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Episódios obtidos com sucesso',
                data: episodes
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter estatísticas gerais
     */
    static async getContentStats(req, res, next) {
        try {
            const stats = await ContentService.getContentStats();
            
            // Log do acesso às estatísticas
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_STATS,
                description: 'Content statistics accessed',
                metadata: {
                    totalViews: stats.totalViews
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Estatísticas obtidas com sucesso',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter estatísticas de visualização de um conteúdo
     */
    static async getContentViewStats(req, res, next) {
        try {
            const { contentId } = req.params;
            const { timeRange = '7d' } = req.query;
            
            const stats = await ContentService.getContentViewStats(contentId, timeRange);
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_VIEW_STATS,
                description: 'Content view statistics accessed',
                metadata: {
                    contentId,
                    timeRange,
                    totalViews: stats.totalViews
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Estatísticas de visualização obtidas com sucesso',
                data: stats
            });
        } catch (error) {
            if (error.message.includes('não encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Testar conectividade de conteúdo (admin)
     */
    static async testContentConnectivity(req, res, next) {
        try {
            const { contentId } = req.params;
            
            const testResult = await ContentService.testContentConnectivity(contentId);
            
            // Log do teste
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_STATS,
                description: 'Content connectivity tested',
                metadata: testResult,
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: testResult.status === 'success',
                message: testResult.status === 'success' ? 'Conectividade testada com sucesso' : 'Falha no teste de conectividade',
                data: testResult
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter recomendações para usuário
     */
    static async getRecommendations(req, res, next) {
        try {
            const { limit = 10 } = req.query;
            const userId = req.user.userId;
            
            const recommendations = await ContentService.getRecommendations(userId, parseInt(limit));
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId,
                actionType: ACTION_TYPES.CONTENT_LIST,
                description: 'Content recommendations accessed',
                metadata: {
                    limit: parseInt(limit),
                    recommendationsCount: recommendations.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Recomendações obtidas com sucesso',
                data: recommendations
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ContentController;