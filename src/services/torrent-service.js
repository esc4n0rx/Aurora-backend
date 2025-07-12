const TorrentUtils = require('../utils/torrent-utils');
const streamCache = require('./stream-cache-service');
const { logger } = require('../config/logger');

class TorrentService {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.initPromise = null;
        
        // Validar configuração
        TorrentUtils.validateTorrentConfig();
    }

    /**
     * Inicializar WebTorrent de forma assíncrona
     */
    async initialize() {
        if (this.isInitialized) {
            return this.client;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    async _doInitialize() {
        try {
            // Import dinâmico para compatibilidade ESM
            let WebTorrent;
            try {
                // Tentar import moderno primeiro
                const { default: WT } = await import('webtorrent');
                WebTorrent = WT;
            } catch (importError) {
                // Fallback para require se disponível
                WebTorrent = require('webtorrent');
            }

            this.client = new WebTorrent();
            this.setupClientEvents();
            this.isInitialized = true;
            
            logger.info('TorrentService initialized', {
                nodeId: this.client.nodeId,
                maxConns: this.client.maxConns
            });

            return this.client;
        } catch (error) {
            logger.error('Failed to initialize WebTorrent', {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Falha ao inicializar WebTorrent: ${error.message}`);
        }
    }

    /**
     * Configurar eventos do cliente WebTorrent
     */
    setupClientEvents() {
        if (!this.client) return;

        this.client.on('error', (err) => {
            logger.error('WebTorrent client error', {
                error: err.message,
                stack: err.stack
            });
        });

        this.client.on('torrent', (torrent) => {
            logger.info('Torrent added to client', {
                infoHash: torrent.infoHash,
                name: torrent.name
            });
        });
    }

    /**
     * Iniciar streaming de torrent
     */
    async startTorrentStream(magnetUrl) {
        try {
            // Garantir que WebTorrent está inicializado
            await this.initialize();

            const streamId = TorrentUtils.generateStreamId(magnetUrl);
            
            // Verificar se já existe no cache
            if (streamCache.hasStream(streamId)) {
                logger.info('Torrent stream found in cache', { streamId });
                return streamCache.getStream(streamId);
            }

            logger.info('Starting new torrent stream', {
                streamId,
                magnetUrl: magnetUrl.substring(0, 50) + '...'
            });

            // Criar promise para aguardar o torrent estar pronto
            const torrentData = await this.downloadTorrent(magnetUrl);
            
            // Encontrar melhor arquivo de vídeo
            const videoFile = TorrentUtils.findBestVideoFile(torrentData.torrent.files);
            
            if (!videoFile) {
                throw new Error('Nenhum arquivo de vídeo encontrado no torrent');
            }

            const streamData = {
                streamId,
                torrent: torrentData.torrent,
                file: videoFile,
                filename: videoFile.name,
                fileSize: videoFile.length,
                magnetUrl,
                progress: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                peers: 0
            };

            // Adicionar ao cache
            const cachedStream = streamCache.addStream(streamId, streamData);
            
            // Configurar atualizações de progresso
            this.setupProgressTracking(torrentData.torrent, streamId);
            
            logger.info('Torrent stream ready', {
                streamId,
                filename: videoFile.name,
                fileSize: TorrentUtils.formatFileSize(videoFile.length)
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
     * Download do torrent
     */
    async downloadTorrent(magnetUrl) {
        if (!this.client) {
            throw new Error('WebTorrent client não inicializado');
        }

        return new Promise((resolve, reject) => {
            const torrent = this.client.add(magnetUrl, {
                strategy: 'sequential' // Download sequencial para streaming
            });

            const timeout = setTimeout(() => {
                torrent.destroy();
                reject(new Error('Timeout aguardando torrent ficar pronto'));
            }, 30000); // 30 segundos de timeout

            torrent.on('ready', () => {
                clearTimeout(timeout);
                resolve({ torrent });
            });

            torrent.on('error', (err) => {
                clearTimeout(timeout);
                reject(new Error(`Erro no torrent: ${err.message}`));
            });
        });
    }

    /**
     * Configurar tracking de progresso
     */
    setupProgressTracking(torrent, streamId) {
        const updateInterval = setInterval(() => {
            const stream = streamCache.getStream(streamId);
            
            if (!stream || torrent.destroyed) {
                clearInterval(updateInterval);
                return;
            }

            // Atualizar estatísticas
            stream.progress = Math.round(torrent.progress * 100);
            stream.downloadSpeed = torrent.downloadSpeed;
            stream.uploadSpeed = torrent.uploadSpeed;
            stream.peers = torrent.numPeers;

            // Log periódico do progresso
            if (stream.progress % 10 === 0) { // Log a cada 10%
                logger.info('Torrent download progress', {
                    streamId,
                    progress: `${stream.progress}%`,
                    downloadSpeed: TorrentUtils.formatFileSize(stream.downloadSpeed) + '/s',
                    peers: stream.peers
                });
            }
        }, 2000); // Atualizar a cada 2 segundos
    }

    /**
     * Criar stream de um arquivo do torrent
     */
    createFileStream(streamId, start = 0, end = null) {
        const stream = streamCache.getStream(streamId);
        
        if (!stream) {
            throw new Error('Stream não encontrado no cache');
        }

        const { file } = stream;
        
        // Definir end se não fornecido
        if (end === null) {
            end = file.length - 1;
        }

        logger.info('Creating file stream', {
            streamId,
            filename: file.name,
            range: `${start}-${end}`,
            totalSize: file.length
        });

        // Criar stream do arquivo com range
        return file.createReadStream({ start, end });
    }

    /**
     * Obter informações do stream
     */
    getStreamInfo(streamId) {
        const stream = streamCache.getStream(streamId);
        
        if (!stream) {
            return null;
        }

        return {
            streamId: stream.streamId,
            filename: stream.filename,
            fileSize: stream.fileSize,
            progress: stream.progress,
            downloadSpeed: stream.downloadSpeed,
            uploadSpeed: stream.uploadSpeed,
            peers: stream.peers,
            activeConnections: stream.activeConnections,
            createdAt: stream.createdAt,
            lastAccessed: stream.lastAccessed
        };
    }

    /**
     * Parar stream
     */
    stopStream(streamId) {
        const stream = streamCache.getStream(streamId);
        
        if (stream && stream.activeConnections === 0) {
            streamCache.removeStream(streamId);
            
            logger.info('Torrent stream stopped', {
                streamId,
                filename: stream.filename
            });
        }
    }

    /**
     * Obter estatísticas gerais
     */
    getStats() {
        if (!this.client) {
            return {
                client: {
                    torrents: 0,
                    downloadSpeed: 0,
                    uploadSpeed: 0,
                    ratio: 0,
                    initialized: false
                },
                cache: streamCache.getCacheStats()
            };
        }

        return {
            client: {
                torrents: this.client.torrents.length,
                downloadSpeed: this.client.downloadSpeed,
                uploadSpeed: this.client.uploadSpeed,
                ratio: this.client.ratio,
                initialized: this.isInitialized
            },
            cache: streamCache.getCacheStats()
        };
    }

    /**
     * Destruir serviço
     */
    destroy() {
        streamCache.stopCleanupProcess();
        streamCache.clearCache();
        
        if (this.client) {
            this.client.destroy();
        }
        
        this.isInitialized = false;
        this.initPromise = null;
        
        logger.info('TorrentService destroyed');
    }
}

// Singleton
const torrentService = new TorrentService();

// Cleanup graceful no processo
process.on('SIGINT', () => {
    torrentService.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    torrentService.destroy();
    process.exit(0);
});

module.exports = torrentService;