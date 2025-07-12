const { logger } = require('../config/logger');
const TorrentUtils = require('../utils/torrent-utils');

class StreamCacheService {
    constructor() {
        this.activeStreams = new Map(); // streamId -> streamData
        this.streamCleanupInterval = null;
        this.maxCacheSize = parseInt(process.env.TORRENT_MAX_CACHE_SIZE) || 10;
        this.cacheTTL = parseInt(process.env.TORRENT_CACHE_TTL) || 3600000; // 1 hora em ms
        
        this.startCleanupProcess();
    }

    /**
     * Adicionar stream ao cache
     */
    addStream(streamId, streamData) {
        // Verificar limite de cache
        if (this.activeStreams.size >= this.maxCacheSize) {
            this.evictOldestStream();
        }

        const cacheEntry = {
            ...streamData,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            activeConnections: 0
        };

        this.activeStreams.set(streamId, cacheEntry);
        
        logger.info('Stream added to cache', {
            streamId,
            totalCachedStreams: this.activeStreams.size,
            filename: streamData.filename
        });

        return cacheEntry;
    }

    /**
     * Obter stream do cache
     */
    getStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        
        if (stream) {
            stream.lastAccessed = Date.now();
            stream.activeConnections++;
            
            logger.info('Stream accessed from cache', {
                streamId,
                activeConnections: stream.activeConnections,
                filename: stream.filename
            });
        }
        
        return stream;
    }

    /**
     * Decrementar conexões ativas
     */
    releaseStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        
        if (stream && stream.activeConnections > 0) {
            stream.activeConnections--;
            
            logger.info('Stream connection released', {
                streamId,
                activeConnections: stream.activeConnections,
                filename: stream.filename
            });
        }
    }

    /**
     * Remover stream do cache
     */
    removeStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        
        if (stream) {
            // Destruir torrent se existir
            if (stream.torrent && !stream.torrent.destroyed) {
                stream.torrent.destroy();
            }
            
            this.activeStreams.delete(streamId);
            
            logger.info('Stream removed from cache', {
                streamId,
                filename: stream.filename,
                totalCachedStreams: this.activeStreams.size
            });
        }
    }

    /**
     * Verificar se stream existe no cache
     */
    hasStream(streamId) {
        return this.activeStreams.has(streamId);
    }

    /**
     * Obter estatísticas do cache
     */
    getCacheStats() {
        const streams = Array.from(this.activeStreams.values());
        
        return {
            totalStreams: this.activeStreams.size,
            maxCacheSize: this.maxCacheSize,
            totalActiveConnections: streams.reduce((sum, stream) => sum + stream.activeConnections, 0),
            oldestStreamAge: streams.length > 0 ? 
                Math.min(...streams.map(stream => Date.now() - stream.createdAt)) : 0,
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Remover stream mais antigo
     */
    evictOldestStream() {
        let oldestStreamId = null;
        let oldestTime = Date.now();

        for (const [streamId, stream] of this.activeStreams) {
            // Não remover streams com conexões ativas
            if (stream.activeConnections > 0) {
                continue;
            }

            if (stream.lastAccessed < oldestTime) {
                oldestTime = stream.lastAccessed;
                oldestStreamId = streamId;
            }
        }

        if (oldestStreamId) {
            logger.info('Evicting oldest stream from cache', {
                streamId: oldestStreamId,
                age: Date.now() - oldestTime
            });
            
            this.removeStream(oldestStreamId);
        }
    }

    /**
     * Processo de limpeza automática
     */
    startCleanupProcess() {
        this.streamCleanupInterval = setInterval(() => {
            this.cleanupExpiredStreams();
        }, 60000); // Verificar a cada 1 minuto

        logger.info('Stream cache cleanup process started', {
            interval: '60 seconds',
            cacheTTL: this.cacheTTL
        });
    }

    /**
     * Limpar streams expirados
     */
    cleanupExpiredStreams() {
        const now = Date.now();
        const streamsToRemove = [];

        for (const [streamId, stream] of this.activeStreams) {
            // Remover streams sem conexões ativas e expirados
            if (stream.activeConnections === 0 && 
                (now - stream.lastAccessed) > this.cacheTTL) {
                streamsToRemove.push(streamId);
            }
        }

        if (streamsToRemove.length > 0) {
            logger.info('Cleaning up expired streams', {
                expiredStreams: streamsToRemove.length,
                totalStreams: this.activeStreams.size
            });

            streamsToRemove.forEach(streamId => {
                this.removeStream(streamId);
            });
        }
    }

    /**
     * Parar processo de limpeza
     */
    stopCleanupProcess() {
        if (this.streamCleanupInterval) {
            clearInterval(this.streamCleanupInterval);
            this.streamCleanupInterval = null;
            
            logger.info('Stream cache cleanup process stopped');
        }
    }

    /**
     * Limpar todo o cache
     */
    clearCache() {
        const streamCount = this.activeStreams.size;
        
        // Destruir todos os torrents
        for (const [streamId, stream] of this.activeStreams) {
            if (stream.torrent && !stream.torrent.destroyed) {
                stream.torrent.destroy();
            }
        }
        
        this.activeStreams.clear();
        
        logger.info('Cache cleared', {
            removedStreams: streamCount
        });
    }
}

// Singleton para gerenciar cache globalmente
const streamCache = new StreamCacheService();

module.exports = streamCache;