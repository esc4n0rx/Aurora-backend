const ProxyService = require('../services/proxy-service');
const ContentService = require('../services/content-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');
const HLSUtils = require('../utils/hls-utils');

class ProxyController {
    /**
     * Criar proxy para conteúdo
     */
    static async createContentProxy(req, res, next) {
        try {
            const { contentId } = req.params;
            
            // Verificar se conteúdo existe
            const content = await ContentService.getContentById(contentId);
            
            if (!content.ativo) {
                return res.status(400).json({
                    success: false,
                    message: 'Conteúdo não está ativo'
                });
            }

            // Criar proxy
            const proxyData = await ProxyService.createContentProxy(
                contentId, 
                content.url_transmissao
            );

            // Log da criação do proxy
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_START,
                description: 'Content proxy created',
                metadata: {
                    contentId,
                    contentName: content.nome,
                    proxyId: proxyData.proxyId,
                    originalUrl: content.url_transmissao,
                    contentType: proxyData.contentType
                },
                request: req,
                statusCode: 201
            });

            res.status(201).json({
                success: true,
                message: 'Proxy criado com sucesso',
                data: {
                    ...proxyData,
                    content: {
                        id: content.id,
                        nome: content.nome,
                        categoria: content.categoria,
                        poster: content.poster
                    }
                }
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_START,
                description: 'Content proxy creation failed',
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

            if (error.message.includes('inválida')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            next(error);
        }
    }

    /**
     * Stream através do proxy
     */
    static async streamProxy(req, res, next) {
        try {
            const { proxyId } = req.params;
            
            // Fazer proxy da requisição
            await ProxyService.proxyStreamRequest(proxyId, req, res);
            
            // Log será feito automaticamente pelo middleware de stream
        } catch (error) {
            // Log da falha no streaming
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_ACCESS,
                description: 'Proxy stream failed',
                metadata: {
                    proxyId: req.params.proxyId,
                    error: error.message,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                },
                request: req,
                statusCode: res.statusCode || 500
            });

            if (error.message.includes('não encontrado') || 
                error.message.includes('expirado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Stream não encontrado ou expirado',
                    suggestion: 'Crie um novo proxy para este conteúdo'
                });
            }

            if (error.message.includes('Limite máximo')) {
                return res.status(429).json({
                    success: false,
                    message: 'Servidor temporariamente sobrecarregado',
                    retryAfter: 300
                });
            }

            // Para outros erros, retornar erro genérico
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erro no streaming',
                    suggestion: 'Tente novamente em alguns instantes'
                });
            }
        }
    }

    /**
     * Stream de URL codificada (segmentos de playlist)
     */
    static async streamEncodedUrl(req, res, next) {
        try {
            const { encodedUrl } = req.params;
            
            // Fazer proxy da URL codificada
            await ProxyService.proxyEncodedUrl(encodedUrl, req, res);
            
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_ACCESS,
                description: 'Encoded URL proxy failed',
                metadata: {
                    encodedUrl: req.params.encodedUrl,
                    error: error.message,
                    ip: req.ip
                },
                request: req,
                statusCode: 400
            });

            if (error.message.includes('inválida')) {
                return res.status(400).json({
                    success: false,
                    message: 'URL de segmento inválida'
                });
            }

            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Erro no streaming de segmento'
                });
            }
        }
    }

    /**
     * Obter informações do proxy
     */
    static async getProxyInfo(req, res, next) {
        try {
            const { proxyId } = req.params;
            
            const proxyInfo = await ProxyService.getProxyInfo(proxyId);
            
            if (!proxyInfo) {
                return res.status(404).json({
                    success: false,
                    message: 'Proxy não encontrado'
                });
            }

            // Log do acesso às informações
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_INFO,
                description: 'Proxy info accessed',
                metadata: {
                    proxyId,
                    contentId: proxyInfo.contentId
                },
                request: req,
                statusCode: 200
            });

            res.json({
                success: true,
                message: 'Informações do proxy obtidas com sucesso',
                data: {
                    proxyId: proxyInfo.proxyId,
                    contentId: proxyInfo.contentId,
                    contentType: proxyInfo.contentType,
                    requiresAuth: proxyInfo.requiresAuth,
                    createdAt: proxyInfo.createdAt,
                    streamUrl: `/api/v1/proxy/stream/${proxyId}`
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter estatísticas do proxy (admin)
     */
    static async getProxyStats(req, res, next) {
        try {
            const stats = ProxyService.getStats();
            
            // Log do acesso às estatísticas
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.STREAM_STATS,
                description: 'Proxy statistics accessed',
                metadata: {
                    activeConnections: stats.activeConnections,
                    cacheStats: stats.cache
                },
                request: req,
                statusCode: 200
            });

            res.json({
                success: true,
                message: 'Estatísticas do proxy obtidas com sucesso',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Limpar cache do proxy (admin)
     */
    static async clearProxyCache(req, res, next) {
        try {
            const { contentId } = req.body;
            
            if (contentId) {
                // Limpar cache de um conteúdo específico
                const proxyCacheService = require('../services/proxy-cache-service');
                proxyCacheService.invalidateContent(contentId);
                
                await LoggingService.logUserAction({
                    userId: req.user.userId,
                    actionType: ACTION_TYPES.STREAM_STATS,
                    description: 'Content cache cleared',
                    metadata: { contentId },
                    request: req,
                    statusCode: 200
                });

                res.json({
                    success: true,
                    message: `Cache do conteúdo ${contentId} limpo com sucesso`
                });
            } else {
                // Limpar todo o cache
                const proxyCacheService = require('../services/proxy-cache-service');
                proxyCacheService.flushAll();
                
                await LoggingService.logUserAction({
                    userId: req.user.userId,
                    actionType: ACTION_TYPES.STREAM_STATS,
                    description: 'All proxy cache cleared',
                    metadata: {},
                    request: req,
                    statusCode: 200
                });

                res.json({
                    success: true,
                    message: 'Todo o cache do proxy foi limpo com sucesso'
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Testar URL de streaming
     */
    static async testStreamingUrl(req, res, next) {
        try {
            const { url } = req.body;
            
            if (!url) {
                return res.status(400).json({
                    success: false,
                    message: 'URL é obrigatória'
                });
            }

            // Validar URL
            const ProxyUtils = require('../utils/proxy-utils');
            if (!ProxyUtils.isValidStreamingUrl(url)) {
                return res.status(400).json({
                    success: false,
                    message: 'URL de streaming inválida'
                });
            }

            // Testar conectividade
            const axios = require('axios');
            try {
                const response = await axios.head(url, { timeout: 10000 });
                
                const testResult = {
                    url,
                    status: 'success',
                    statusCode: response.status,
                    contentType: response.headers['content-type'],
                    contentLength: response.headers['content-length'],
                    isPlaylist: url.includes('.m3u8'),
                    requiresAuth: ProxyUtils.requiresAuth(url)
                };

                // Log do teste
                await LoggingService.logUserAction({
                    userId: req.user.userId,
                    actionType: ACTION_TYPES.STREAM_STATS,
                    description: 'Streaming URL tested',
                    metadata: testResult,
                    request: req,
                    statusCode: 200
                });

                res.json({
                    success: true,
                    message: 'URL testada com sucesso',
                    data: testResult
                });
            } catch (testError) {
                const errorResult = {
                    url,
                    status: 'error',
                    error: testError.message,
                    code: testError.code
                };

                res.json({
                    success: false,
                    message: 'Falha ao testar URL',
                    data: errorResult
                });
            }
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ProxyController;