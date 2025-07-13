const { Worker } = require('worker_threads');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const TorrentUtils = require('../utils/torrent-utils');
const streamCache = require('./stream-cache-service');
const streamPool = require('./stream-pool-service');
const { logger } = require('../config/logger');

class TorrentService extends EventEmitter {
    constructor() {
        super();
        this.worker = null;
        this.pendingRequests = new Map();
        this.isInitialized = false;
        this.initPromise = null;
        
        // Configurar limpeza automática
        this.setupCleanupSchedule();
        
        // Escutar eventos do pool de streams
        streamPool.on('streamInactive', (streamId) => {
            this.handleStreamInactive(streamId);
        });
    }

    /**
     * Inicializar serviço de forma assíncrona e não-bloqueante
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    async _doInitialize() {
        try {
            // Criar worker em thread separado
            const workerPath = path.join(__dirname, '../workers/torrent-worker.js');
            this.worker = new Worker(workerPath);
            
            this.setupWorkerEvents();
            
            // Aguardar inicialização do worker
            await this.waitForWorkerInitialization();
            
            this.isInitialized = true;
            
            logger.info('TorrentService initialized with worker thread');
            return true;
        } catch (error) {
            logger.error('Failed to initialize TorrentService', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Configurar eventos do worker
     */
    setupWorkerEvents() {
        this.worker.on('message', (message) => {
            this.handleWorkerMessage(message);
        });

        this.worker.on('error', (error) => {
            logger.error('Torrent worker error', {
                error: error.message,
                stack: error.stack
            });
            this.emit('worker_error', error);
        });

        this.worker.on('exit', (code) => {
            logger.warn('Torrent worker exited', { code });
            this.isInitialized = false;
            this.worker = null;
        });
    }

    /**
     * Aguardar inicialização do worker
     */
    waitForWorkerInitialization() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Worker initialization timeout'));
            }, 10000);

            const messageHandler = (message) => {
                if (message.type === 'initialized') {
                    clearTimeout(timeout);
                    this.worker.off('message', messageHandler);
                    resolve(message.data);
                } else if (message.type === 'error') {
                    clearTimeout(timeout);
                    this.worker.off('message', messageHandler);
                    reject(new Error(message.data.message));
                }
            };

            this.worker.on('message', messageHandler);
        });
    }

    /**
     * Processar mensagens do worker
     */
    handleWorkerMessage(message) {
        const { type, data, requestId } = message;

        switch (type) {
            case 'torrent_ready':
                this.resolveRequest(requestId, data);
                break;

            case 'torrent_info':
                this.resolveRequest(requestId, data);
                break;

            case 'stats':
                this.resolveRequest(requestId, data);
                break;

            case 'error':
                this.rejectRequest(requestId, new Error(data.message));
                break;

            case 'progress_update':
                this.updateStreamProgress(data);
                break;

            case 'torrent_added':
            case 'torrent_removed':
                // Log eventos informativos
                logger.info(`Worker event: ${type}`, data);
                break;
        }
    }

    /**
     * Enviar mensagem para worker com timeout
     */
    sendWorkerMessage(type, data, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not available'));
                return;
            }

            const requestId = crypto.randomUUID();
            
            // Configurar timeout
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Worker request timeout: ${type}`));
            }, timeout);

            // Armazenar request pendente
            this.pendingRequests.set(requestId, {
                resolve: (data) => {
                    clearTimeout(timeoutHandle);
                    resolve(data);
                },
                reject: (error) => {
                    clearTimeout(timeoutHandle);
                    reject(error);
                }
            });

            // Enviar mensagem
            this.worker.postMessage({
                type,
                data: { ...data, requestId }
            });
        });
    }

    /**
     * Resolver request pendente
     */
    resolveRequest(requestId, data) {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            this.pendingRequests.delete(requestId);
            request.resolve(data);
        }
    }

    /**
     * Rejeitar request pendente
     */
    rejectRequest(requestId, error) {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            this.pendingRequests.delete(requestId);
            request.reject(error);
        }
    }

    /**
     * Atualizar progresso do stream
     */
    updateStreamProgress(data) {
        const stream = streamCache.getStream(data.streamId);
        if (stream) {
            stream.progress = data.progress;
            stream.downloadSpeed = data.downloadSpeed;
            stream.uploadSpeed = data.uploadSpeed;
            stream.peers = data.peers;
        }
    }

    /**
     * Iniciar streaming de torrent (não-bloqueante)
     */
    async startTorrentStream(magnetUrl) {
        try {
            // Garantir inicialização
            await this.initialize();

            const streamId = TorrentUtils.generateStreamId(magnetUrl);
            
            // Verificar cache primeiro
            if (streamCache.hasStream(streamId)) {
                logger.info('Torrent stream found in cache', { streamId });
                return streamCache.getStream(streamId);
            }

            logger.info('Starting new torrent stream', {
                streamId,
                magnetUrl: magnetUrl.substring(0, 50) + '...'
            });

            // Solicitar ao worker para adicionar torrent
            const workerData = await this.sendWorkerMessage('add_torrent', {
                magnetUrl,
                streamId
            });

            // Criar dados do stream
            const streamData = {
                streamId: workerData.streamId,
                filename: workerData.filename,
                fileSize: workerData.fileSize,
                magnetUrl,
                infoHash: workerData.infoHash,
                progress: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                peers: 0,
                isReady: true
            };

            // Adicionar ao cache
            const cachedStream = streamCache.addStream(streamId, streamData);
            
            logger.info('Torrent stream ready', {
                streamId,
                filename: workerData.filename,
                fileSize: TorrentUtils.formatFileSize(workerData.fileSize)
            });

            return cachedStream;
        } catch (error) {
            logger.error('Failed to start torrent stream', {
                error: error.message,
                magnetUrl: magnetUrl.substring(0, 50) + '...'
            });
            throw error;
        }
    }

    /**
     * Criar stream de arquivo (com pool de conexões)
     */
    createFileStream(streamId, start = 0, end = null, req) {
        try {
            // Registrar conexão no pool
            const connectionId = crypto.randomUUID();
            streamPool.registerConnection(streamId, connectionId, req);

            // Simular criação de stream (o worker gerencia o arquivo real)
            const stream = streamCache.getStream(streamId);
            
            if (!stream) {
                streamPool.removeConnection(connectionId, streamId);
                throw new Error('Stream not found in cache');
            }

            // Atualizar atividade
            streamPool.updateActivity(connectionId, streamId);

            logger.info('File stream created', {
                streamId,
                connectionId,
                range: `${start}-${end || 'end'}`,
                filename: stream.filename
            });

            // Retornar mock stream para compatibilidade
            // Na implementação real, o worker gerenciaria o stream de arquivo
            const mockStream = new (require('stream').Readable)({
                read() {
                    // Implementação mock - substituir por comunicação com worker
                    this.push(null);
                }
            });

            // Cleanup quando stream acabar
            mockStream.on('end', () => {
                streamPool.removeConnection(connectionId, streamId);
            });

            mockStream.on('error', () => {
                streamPool.removeConnection(connectionId, streamId);
            });

            return mockStream;
        } catch (error) {
            logger.error('Failed to create file stream', {
                streamId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter informações do stream
     */
    async getStreamInfo(streamId) {
        try {
            const cachedStream = streamCache.getStream(streamId);
            
            if (!cachedStream) {
                return null;
            }

            // Obter info adicional do worker se necessário
            let workerInfo = null;
            try {
                workerInfo = await this.sendWorkerMessage('get_info', { streamId }, 5000);
            } catch (error) {
                logger.warn('Failed to get worker info', { streamId, error: error.message });
            }

            // Combinar informações
            return {
                ...cachedStream,
                ...(workerInfo || {}),
                poolInfo: streamPool.getStreamInfo(streamId)
            };
        } catch (error) {
            logger.error('Failed to get stream info', {
                streamId,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Parar stream
     */
    async stopStream(streamId) {
        try {
            // Remover do pool
            streamPool.forceRemoveStream(streamId);
            
            // Remover do cache
            streamCache.removeStream(streamId);
            
            // Notificar worker
            if (this.worker) {
                this.worker.postMessage({
                    type: 'remove_torrent',
                    data: { streamId }
                });
            }
            
            logger.info('Stream stopped', { streamId });
        } catch (error) {
            logger.error('Failed to stop stream', {
                streamId,
                error: error.message
            });
        }
    }

    /**
     * Lidar com streams inativos
     */
    handleStreamInactive(streamId) {
        logger.info('Handling inactive stream', { streamId });
        
        // Remover stream após delay para dar chance de reconexão
        setTimeout(() => {
            if (!streamPool.hasActiveConnections(streamId)) {
                this.stopStream(streamId);
            }
        }, 30000); // 30 segundos de grace period
    }

    /**
     * Configurar limpeza automática
     */
    setupCleanupSchedule() {
        // Limpeza a cada 5 minutos
        setInterval(() => {
            this.performCleanup();
        }, 300000);

        logger.info('Torrent cleanup schedule configured');
    }

    /**
     * Executar limpeza
     */
    async performCleanup() {
        try {
            // Limpar no worker
            if (this.worker) {
                this.worker.postMessage({
                    type: 'cleanup',
                    data: {}
                });
            }

            // Limpar cache local
            streamCache.cleanupExpiredStreams();
            
            logger.info('Torrent cleanup completed');
        } catch (error) {
            logger.error('Cleanup failed', {
                error: error.message
            });
        }
    }

    /**
     * Obter estatísticas gerais
     */
    async getStats() {
        try {
            let workerStats = null;
            
            if (this.worker && this.isInitialized) {
                try {
                    workerStats = await this.sendWorkerMessage('get_stats', {}, 5000);
                } catch (error) {
                    logger.warn('Failed to get worker stats', { error: error.message });
                }
            }

            return {
                service: {
                    initialized: this.isInitialized,
                    pendingRequests: this.pendingRequests.size,
                    hasWorker: !!this.worker
                },
                worker: workerStats || {
                    torrentsCount: 0,
                    clientStats: null
                },
                cache: streamCache.getCacheStats(),
                pool: streamPool.getStats()
            };
        } catch (error) {
            logger.error('Failed to get stats', {
                error: error.message
            });
            
            return {
                service: {
                    initialized: false,
                    error: error.message
                },
                cache: streamCache.getCacheStats(),
                pool: streamPool.getStats()
            };
        }
    }

    /**
     * Destruir serviço
     */
    async destroy() {
        try {
            logger.info('Destroying TorrentService...');

            // Parar cleanup
            clearInterval(this.cleanupInterval);

            // Limpar requests pendentes
            for (const [requestId, request] of this.pendingRequests) {
                request.reject(new Error('Service shutting down'));
            }
            this.pendingRequests.clear();

            // Shutdown worker
            if (this.worker) {
                this.worker.postMessage({
                    type: 'shutdown',
                    data: {}
                });

                // Aguardar shutdown ou forçar após timeout
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        if (this.worker) {
                            this.worker.terminate();
                        }
                        resolve();
                    }, 5000);

                    const messageHandler = (message) => {
                        if (message.type === 'shutdown_complete') {
                            clearTimeout(timeout);
                            this.worker.off('message', messageHandler);
                            resolve();
                        }
                    };

                    this.worker.on('message', messageHandler);
                });
            }

            // Cleanup serviços
            streamPool.shutdown();
            streamCache.clearCache();

            this.isInitialized = false;
            this.worker = null;
            this.initPromise = null;

            logger.info('TorrentService destroyed');
        } catch (error) {
            logger.error('Error destroying TorrentService', {
                error: error.message
            });
        }
    }
}

// Singleton
const torrentService = new TorrentService();

// Cleanup graceful no processo
process.on('SIGINT', async () => {
    await torrentService.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await torrentService.destroy();
    process.exit(0);
});

module.exports = torrentService;