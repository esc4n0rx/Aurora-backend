const NodeCache = require('node-cache');
const { logger } = require('../config/logger');

class ProxyCacheService {
    constructor() {
        // Cache para URLs de streaming (TTL: 30 minutos)
        this.urlCache = new NodeCache({
            stdTTL: 1800, // 30 minutos
            checkperiod: 300, // Verificar expiração a cada 5 minutos
            useClones: false
        });
        
        // Cache para playlists M3U8 (TTL: 5 minutos)
        this.playlistCache = new NodeCache({
            stdTTL: 300, // 5 minutos
            checkperiod: 60, // Verificar expiração a cada 1 minuto
            useClones: false
        });
        
        // Cache para segmentos TS (TTL: 1 hora)
        this.segmentCache = new NodeCache({
            stdTTL: 3600, // 1 hora
            checkperiod: 600, // Verificar expiração a cada 10 minutos
            useClones: false
        });

        this.setupEventListeners();
    }

    /**
     * Configurar listeners de eventos
     */
    setupEventListeners() {
        this.urlCache.on('expired', (key, value) => {
            logger.info('URL cache expired', { key });
        });

        this.playlistCache.on('expired', (key, value) => {
            logger.info('Playlist cache expired', { key });
        });

        this.segmentCache.on('expired', (key, value) => {
            logger.info('Segment cache expired', { key });
        });
    }

    /**
     * Obter proxy info do cache
     */
    getProxyInfo(proxyId) {
        return this.urlCache.get(proxyId);
    }

    /**
     * Armazenar proxy info no cache
     */
    setProxyInfo(proxyId, proxyInfo) {
        return this.urlCache.set(proxyId, proxyInfo);
    }

    /**
     * Obter playlist do cache
     */
    getPlaylist(url) {
        const key = this.generatePlaylistKey(url);
        return this.playlistCache.get(key);
    }

    /**
     * Armazenar playlist no cache
     */
    setPlaylist(url, content, headers = {}) {
        const key = this.generatePlaylistKey(url);
        const cacheData = {
            content,
            headers,
            timestamp: Date.now()
        };
        
        return this.playlistCache.set(key, cacheData);
    }

    /**
     * Obter segmento do cache
     */
    getSegment(url) {
        const key = this.generateSegmentKey(url);
        const cached = this.segmentCache.get(key);
        
        if (cached) {
            // Atualizar último acesso
            cached.lastAccess = Date.now();
            this.segmentCache.set(key, cached);
        }
        
        return cached;
    }

    /**
     * Armazenar segmento no cache
     */
    setSegment(url, buffer, headers = {}) {
        const key = this.generateSegmentKey(url);
        const cacheData = {
            buffer,
            headers,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            size: buffer.length
        };
        
        return this.segmentCache.set(key, cacheData);
    }

    /**
     * Invalidar cache de um conteúdo
     */
    invalidateContent(contentId) {
        const keys = this.urlCache.keys();
        const contentKeys = keys.filter(key => key.startsWith(contentId));
        
        contentKeys.forEach(key => {
            this.urlCache.del(key);
        });
        
        logger.info('Cache invalidated for content', { contentId, keysRemoved: contentKeys.length });
    }

    /**
     * Obter estatísticas do cache
     */
    getStats() {
        return {
            urls: {
                keys: this.urlCache.keys().length,
                hits: this.urlCache.getStats().hits,
                misses: this.urlCache.getStats().misses
            },
            playlists: {
                keys: this.playlistCache.keys().length,
                hits: this.playlistCache.getStats().hits,
                misses: this.playlistCache.getStats().misses
            },
            segments: {
                keys: this.segmentCache.keys().length,
                hits: this.segmentCache.getStats().hits,
                misses: this.segmentCache.getStats().misses,
                totalSize: this.calculateSegmentCacheSize()
            }
        };
    }

    /**
     * Calcular tamanho total do cache de segmentos
     */
    calculateSegmentCacheSize() {
        const keys = this.segmentCache.keys();
        let totalSize = 0;
        
        keys.forEach(key => {
            const segment = this.segmentCache.get(key);
            if (segment && segment.size) {
                totalSize += segment.size;
            }
        });
        
        return totalSize;
    }

    /**
     * Limpar cache antigo
     */
    cleanupOldCache() {
        const now = Date.now();
        const maxAge = 2 * 60 * 60 * 1000; // 2 horas
        
        // Limpar segmentos antigos
        const segmentKeys = this.segmentCache.keys();
        let removedSegments = 0;
        
        segmentKeys.forEach(key => {
            const segment = this.segmentCache.get(key);
            if (segment && (now - segment.lastAccess) > maxAge) {
                this.segmentCache.del(key);
                removedSegments++;
            }
        });
        
        if (removedSegments > 0) {
            logger.info('Cleaned up old segments from cache', { removedSegments });
        }
    }

    /**
     * Gerar chave para playlist
     */
    generatePlaylistKey(url) {
        const crypto = require('crypto');
        return 'playlist_' + crypto.createHash('md5').update(url).digest('hex');
    }

    /**
     * Gerar chave para segmento
     */
    generateSegmentKey(url) {
        const crypto = require('crypto');
        return 'segment_' + crypto.createHash('md5').update(url).digest('hex');
    }

    /**
     * Forçar limpeza completa do cache
     */
    flushAll() {
        this.urlCache.flushAll();
        this.playlistCache.flushAll();
        this.segmentCache.flushAll();
        
        logger.info('All caches flushed');
    }

    /**
     * Configurar TTL personalizado para um item
     */
    setWithTTL(cache, key, value, ttl) {
        return cache.set(key, value, ttl);
    }
}

// Singleton
const proxyCacheService = new ProxyCacheService();

// Limpeza automática a cada 30 minutos
setInterval(() => {
    proxyCacheService.cleanupOldCache();
}, 30 * 60 * 1000);

module.exports = proxyCacheService;