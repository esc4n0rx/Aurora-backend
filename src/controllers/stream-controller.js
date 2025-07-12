const ContentService = require('../services/content-service');
const torrentService = require('../services/torrent-service');
const streamCache = require('../services/stream-cache-service');
const StreamUtils = require('../utils/stream-utils');
const TorrentUtils = require('../utils/torrent-utils');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');
const { logger } = require('../config/logger');

class StreamController {
    /**
     * Iniciar stream de conteúdo
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

            // Iniciar stream do torrent
            const streamData = await torrentService.startTorrentStream(content.url_transmissao);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CONTENT_VIEW,
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
            
            res.json({
                success: true,
                message: 'Stream iniciado com sucesso',
                data: {
                    streamId: streamData.streamId,
                    filename: streamData.filename,
                    fileSize: streamData.fileSize,
                    streamUrl: `/api/v1/stream/${streamData.streamId}/video`,
                    progress: streamData.progress,
                    contentType: StreamUtils.getContentType(streamData.filename)
                }
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CONTENT_VIEW,
                description: 'Torrent stream start failed',
                metadata: {
                    contentId: req.params.contentId,
                    error: error.message
                },
                request: req,
                statusCode: 500
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
     * Stream de vídeo
     */
    static async streamVideo(req, res, next) {
        try {
            const { streamId } = req.params;
            const range = req.get('Range');
            
            // Obter stream do cache
            const streamData = streamCache.getStream(streamId);
            
            if (!streamData) {
                return res.status(404).json({
                    success: false,
                    message: 'Stream não encontrado'
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
                return res.end();
            }

            try {
                // Criar stream do arquivo
                const fileStream = torrentService.createFileStream(streamId, start, end);
                
                // Configurar eventos do stream
                fileStream.on('error', (error) => {
                    logger.error('File stream error', {
                        streamId,
                        error: error.message,
                        range: `${start}-${end}`
                    });
                    
                    if (!res.headersSent) {
                        res.status(500).json({
                            success: false,
                            message: 'Erro no stream de vídeo'
                        });
                    }
                });

                fileStream.on('end', () => {
                    // Decrementar conexões ativas
                    streamCache.releaseStream(streamId);
                    
                    logger.info('Stream completed', {
                        streamId,
                        range: `${start}-${end}`,
                        filename
                    });
                });

                // Configurar cleanup quando cliente desconectar
                req.on('close', () => {
                    streamCache.releaseStream(streamId);
                    
                    if (fileStream && !fileStream.destroyed) {
                        fileStream.destroy();
                    }
                });

                req.on('aborted', () => {
                    streamCache.releaseStream(streamId);
                    
                    if (fileStream && !fileStream.destroyed) {
                        fileStream.destroy();
                    }
                });

                // Pipe do stream para response
                fileStream.pipe(res);
                
            } catch (streamError) {
                logger.error('Failed to create file stream', {
                    streamId,
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
            logger.error('Stream video error', {
                streamId: req.params.streamId,
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
            
            const streamInfo = torrentService.getStreamInfo(streamId);
            
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
            
            torrentService.stopStream(streamId);
            
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
            const stats = torrentService.getStats();
            
            // Log do acesso às estatísticas
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.SYSTEM_STATS,
                description: 'Streaming statistics accessed',
                metadata: {
                    totalTorrents: stats.client.torrents,
                    activeStreams: stats.cache.totalStreams
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

            // Se for torrent, redirecionar para processo de torrent
            if (TorrentUtils.isMagnetLink(content.url_transmissao)) {
                const streamId = TorrentUtils.generateStreamId(content.url_transmissao);
                
                // Verificar se já existe stream ativo
                if (streamCache.hasStream(streamId)) {
                    return res.redirect(`/api/v1/stream/${streamId}/video`);
                }
                
                // Iniciar novo stream
                const streamData = await torrentService.startTorrentStream(content.url_transmissao);
                return res.redirect(`/api/v1/stream/${streamData.streamId}/video`);
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
}

module.exports = StreamController;