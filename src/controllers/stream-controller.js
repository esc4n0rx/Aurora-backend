const ContentService = require('../services/content-service');
const torrentService = require('../services/torrent-service');
const streamCache = require('../services/stream-cache-service');
const streamPool = require('../services/stream-pool-service');
const StreamUtils = require('../utils/stream-utils');
const TorrentUtils = require('../utils/torrent-utils');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');
const { logger } = require('../config/logger');
const crypto = require('crypto');

class StreamController {
    /**
     * Iniciar stream de conteúdo (não-bloqueante)
     */
    static async startStream(req, res, next) {
        try {
            const { contentId } = req.params;
            
            // Buscar conteúdo
            const content = await ContentService.getContentById(contentId);
            
            if (!content.ativo) {
                return res.status(400).json({
                    success: false,
                    message: 'Conteúdo não está ativo'
                });
            }

            // Verificar se é torrent
            if (!TorrentUtils.isMagnetLink(content.url_transmissao)) {
                return res.status(400).json({
                    success: false,
                    message: 'Conteúdo não é um torrent'
                });
            }

            // Responder imediatamente enquanto inicia stream em background
            res.status(202).json({
                success: true,
                message: 'Iniciando stream em background',
                data: {
                    contentId,
                    contentName: content.nome,
                    status: 'initializing',
                    checkUrl: `/api/v1/stream/content/${contentId}/status`
                }
            });

            // Iniciar stream de forma assíncrona
            setImmediate(async () => {
                try {
                    const streamData = await torrentService.startTorrentStream(content.url_transmissao);
                    
                    // Log da ação
                    await LoggingService.logUserAction({
                        userId: req.user?.userId || null,
                        actionType: ACTION_TYPES.STREAM_START,
                        description: 'Torrent stream started',
                        metadata: {
                            contentId,
                            contentName: content.nome,
                            streamId: streamData.streamId,
                            filename: streamData.filename,
                            fileSize: streamData.fileSize
                        },
                        request: req,
                        statusCode: 200
                    });
                    
                    logger.info('Stream started successfully in background', {
                        streamId: streamData.streamId,
                        contentId,
                        filename: streamData.filename
                    });
                } catch (error) {
                    // Log da falha
                    await LoggingService.logUserAction({
                        userId: req.user?.userId || null,
                        actionType: ACTION_TYPES.STREAM_START,
                        description: 'Torrent stream start failed',
                        metadata: {
                            contentId,
                            error: error.message
                        },
                        request: req,
                        statusCode: 500
                    });
                    
                    logger.error('Failed to start stream in background', {
                        contentId,
                        error: error.message
                    });
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
     * Verificar status do stream
     */
    static async getStreamStatus(req, res, next) {
        try {
            const { contentId } = req.params;
            
            // Buscar conteúdo
            const content = await ContentService.getContentById(contentId);
            const streamId = TorrentUtils.generateStreamId(content.url_transmissao);
            
            // Verificar se stream existe
            const streamData = streamCache.getStream(streamId);
            
            if (!streamData) {
                return res.json({
                    success: true,
                    data: {
                        status: 'not_started',
                        message: 'Stream não foi iniciado'
                    }
                });
            }

            // Obter informações completas
            const streamInfo = await torrentService.getStreamInfo(streamId);
            
            res.json({
                success: true,
                data: {
                    status: streamInfo ? 'ready' : 'initializing',
                    streamId,
                    filename: streamData.filename,
                    fileSize: streamData.fileSize,
                    progress: streamData.progress || 0,
                    streamUrl: streamInfo ? `/api/v1/stream/${streamId}/video` : null,
                    contentType: StreamUtils.getContentType(streamData.filename)
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Stream de vídeo otimizado
     */
    static async streamVideo(req, res, next) {
        const streamId = req.params.streamId;
        const connectionId = crypto.randomUUID();
        
        try {
            const range = req.get('Range');
            
            // Obter stream do cache
            const streamData = streamCache.getStream(streamId);
            
            if (!streamData) {
                return res.status(404).json({
                    success: false,
                    message: 'Stream não encontrado ou expirou'
                });
            }

            // Registrar conexão no pool
            try {
                streamPool.registerConnection(streamId, connectionId, req);
            } catch (poolError) {
                return res.status(429).json({
                    success: false,
                    message: poolError.message
                });
            }

            const { filename, fileSize } = streamData;
            
            // Processar range se fornecido
            const parsedRange = StreamUtils.parseRange(range, fileSize);
            const { headers, statusCode, start, end } = StreamUtils.generateStreamHeaders(
                filename, 
                fileSize, 
                parsedRange
            );

            // Configurar headers
            Object.entries(headers).forEach(([key, value]) => {
                res.set(key, value);
            });

            res.status(statusCode);

            // Verificar se é apenas request HEAD
            if (req.method === 'HEAD') {
                streamPool.removeConnection(connectionId, streamId);
                return res.end();
            }

            try {
                // Criar stream do arquivo através do torrent service
                const fileStream = torrentService.createFileStream(streamId, start, end, req);
                
                // Configurar eventos do stream
                fileStream.on('error', (error) => {
                    logger.error('File stream error', {
                        streamId,
                        connectionId,
                        error: error.message,
                        range: `${start}-${end}`
                    });
                    
                    streamPool.removeConnection(connectionId, streamId);
                    
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            message: 'Erro no stream de vídeo'
                        });
                    }
                });

                fileStream.on('end', () => {
                    streamPool.removeConnection(connectionId, streamId);
                    
                    logger.info('Stream completed', {
                        streamId,
                        connectionId,
                        range: `${start}-${end}`,
                        filename
                    });
                });

                // Configurar cleanup quando cliente desconectar
                req.on('close', () => {
                    streamPool.removeConnection(connectionId, streamId);
                    
                    if (fileStream && !fileStream.destroyed) {
                        fileStream.destroy();
                    }
                });

                req.on('aborted', () => {
                    streamPool.removeConnection(connectionId, streamId);
                    
                    if (fileStream && !fileStream.destroyed) {
                        fileStream.destroy();
                    }
                });

                // Atualizar atividade periodicamente
                const activityInterval = setInterval(() => {
                    streamPool.updateActivity(connectionId, streamId);
                }, 10000); // A cada 10 segundos

                fileStream.on('end', () => {
                    clearInterval(activityInterval);
                });

                fileStream.on('error', () => {
                    clearInterval(activityInterval);
                });

                // Pipe do stream para response
                fileStream.pipe(res);
                
            } catch (streamError) {
                streamPool.removeConnection(connectionId, streamId);
                
                logger.error('Failed to create file stream', {
                    streamId,
                    connectionId,
                    error: streamError.message
                });
                
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Erro ao criar stream de vídeo'
                    });
                }
            }
            
        } catch (error) {
            streamPool.removeConnection(connectionId, streamId);
            
            logger.error('Stream video error', {
                streamId,
                connectionId,
                error: error.message,
                stack: error.stack
            });
            
            if (!res.headersSent) {
                next(error);
            }
        }
    }

    /**
     * Obter informações do stream
     */
    static async getStreamInfo(req, res, next) {
        try {
            const { streamId } = req.params;
            
            const streamInfo = await torrentService.getStreamInfo(streamId);
            
            if (!streamInfo) {
                return res.status(404).json({
                    success: false,
                    message: 'Stream não encontrado'
                });
            }
            
            res.json({
                success: true,
                message: 'Informações do stream obtidas com sucesso',
                data: streamInfo
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Parar stream
     */
    static async stopStream(req, res, next) {
        try {
            const { streamId } = req.params;
            
            await torrentService.stopStream(streamId);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_STOP,
                description: 'Stream stopped manually',
                metadata: {
                    streamId
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Stream parado com sucesso'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter estatísticas de streaming
     */
    static async getStreamStats(req, res, next) {
        try {
            const stats = await torrentService.getStats();
            
            // Log do acesso às estatísticas
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_STATS,
                description: 'Streaming statistics accessed',
                metadata: {
                    totalStreams: stats.cache.totalStreams,
                    activeConnections: stats.pool.totalConnections
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Estatísticas de streaming obtidas com sucesso',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Stream direto de conteúdo (compatibilidade)
     */
    static async streamContent(req, res, next) {
        try {
            const { contentId } = req.params;
            
            // Buscar conteúdo
            const content = await ContentService.getContentById(contentId);
            
            if (!content.ativo) {
                return res.status(400).json({
                    success: false,
                    message: 'Conteúdo não está ativo'
                });
            }

            // Se for torrent, verificar se stream existe
            if (TorrentUtils.isMagnetLink(content.url_transmissao)) {
                const streamId = TorrentUtils.generateStreamId(content.url_transmissao);
                
                // Verificar se já existe stream ativo
                if (streamCache.hasStream(streamId)) {
                    return res.redirect(`/api/v1/stream/${streamId}/video`);
                }
                
                // Se não existe, retornar instruções para iniciar
                return res.json({
                    success: false,
                    message: 'Stream não foi iniciado',
                    action: 'start_stream',
                    startUrl: `/api/v1/stream/content/${contentId}/start`,
                    statusUrl: `/api/v1/stream/content/${contentId}/status`
                });
            }
            
            // Para outros tipos de URL (HLS, etc), retornar redirect direto
            res.redirect(content.url_transmissao);
            
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
     * Limpar streams inativos manualmente
     */
    static async cleanupStreams(req, res, next) {
        try {
            await torrentService.performCleanup();
            
            res.json({
                success: true,
                message: 'Limpeza de streams executada com sucesso'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = StreamController;