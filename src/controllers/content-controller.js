const ContentService = require('../services/content-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');
const TorrentUtils = require('../utils/torrent-utils');
const torrentService = require('../services/torrent-service');

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
                    isTorrent: TorrentUtils.isMagnetLink(content.url_transmissao)
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
            
            // Detectar se é torrent e adicionar informações de streaming
            let streamingInfo = null;
            if (TorrentUtils.isMagnetLink(content.url_transmissao)) {
                streamingInfo = {
                    isTorrent: true,
                    streamId: TorrentUtils.generateStreamId(content.url_transmissao),
                    streamStartUrl: `/api/v1/stream/content/${contentId}/start`,
                    streamPlayUrl: `/api/v1/stream/content/${contentId}/play`
                };
            } else {
                streamingInfo = {
                    isTorrent: false,
                    directUrl: content.url_transmissao
                };
            }
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.CONTENT_ACCESS,
                description: 'Content accessed by admin',
                metadata: {
                    contentId: content.id,
                    contentName: content.nome,
                    categoria: content.categoria,
                    isTorrent: streamingInfo.isTorrent
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Conteúdo obtido com sucesso',
                data: {
                    ...content,
                    streaming: streamingInfo
                }
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
                    isTorrent: TorrentUtils.isMagnetLink(content.url_transmissao)
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
     * Registrar visualização de conteúdo
     */
    static async recordView(req, res, next) {
        try {
            const { contentId } = req.params;
            const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
            const userAgent = req.get('User-Agent') || 'unknown';
            
            // Primeiro, obter informações do conteúdo
            const content = await ContentService.getContentById(contentId);
            
            // Se for torrent, inicializar stream automaticamente
            let streamInfo = null;
            if (TorrentUtils.isMagnetLink(content.url_transmissao)) {
                try {
                    // Tentar inicializar o stream do torrent
                    const streamData = await torrentService.startTorrentStream(content.url_transmissao);
                    streamInfo = {
                        streamId: streamData.streamId,
                        streamUrl: `/api/v1/stream/${streamData.streamId}/video`,
                        filename: streamData.filename,
                        fileSize: streamData.fileSize,
                        progress: streamData.progress
                    };
                    
                    // Log específico para início de torrent
                    await LoggingService.logUserAction({
                        userId: req.body.user_id || null,
                        profileId: req.body.profile_id || null,
                        actionType: ACTION_TYPES.TORRENT_DOWNLOAD,
                        description: 'Torrent stream started from content view',
                        metadata: {
                            contentId,
                            contentName: content.nome,
                            streamId: streamData.streamId,
                            filename: streamData.filename,
                            magnetUrl: content.url_transmissao.substring(0, 50) + '...'
                        },
                        request: req,
                        statusCode: 201
                    });
                } catch (torrentError) {
                    // Log do erro do torrent, mas continue com o registro de visualização
                    await LoggingService.logUserAction({
                        userId: req.body.user_id || null,
                        actionType: ACTION_TYPES.TORRENT_DOWNLOAD,
                        description: 'Torrent stream start failed',
                        metadata: {
                            contentId,
                            error: torrentError.message
                        },
                        request: req,
                        statusCode: 400
                    });
                }
            }
            
            // Registrar visualização normal
            const view = await ContentService.recordView(
                contentId,
                req.body,
                ipAddress,
                userAgent
            );
            
            // Log da visualização
            await LoggingService.logUserAction({
                userId: req.body.user_id || null,
                profileId: req.body.profile_id || null,
                actionType: ACTION_TYPES.CONTENT_VIEW,
                description: 'Content view recorded',
                metadata: {
                    contentId,
                    contentName: content.nome,
                    viewDuration: req.body.view_duration,
                    viewPercentage: req.body.view_percentage,
                    ipAddress,
                    isTorrent: TorrentUtils.isMagnetLink(content.url_transmissao),
                    streamInitialized: !!streamInfo
                },
                request: req,
                statusCode: 201
            });
            
            // Resposta incluindo informações de stream se disponível
            const responseData = {
                view,
                content: {
                    id: content.id,
                    nome: content.nome,
                    categoria: content.categoria,
                    subcategoria: content.subcategoria,
                    isTorrent: TorrentUtils.isMagnetLink(content.url_transmissao)
                }
            };
            
            if (streamInfo) {
                responseData.stream = streamInfo;
            }
            
            res.status(201).json({
                success: true,
                message: streamInfo ? 
                    'Visualização registrada e stream iniciado com sucesso' : 
                    'Visualização registrada com sucesso',
                data: responseData
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.body.user_id || null,
                actionType: ACTION_TYPES.CONTENT_VIEW,
                description: 'Content view recording failed',
                metadata: {
                    contentId: req.params.contentId,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado') || 
                error.message.includes('não está ativo') ||
                error.message.includes('já registrada')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
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
                    episodesCount: episodes.length
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
}

module.exports = ContentController;