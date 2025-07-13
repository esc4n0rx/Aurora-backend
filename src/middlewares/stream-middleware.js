const StreamUtils = require('../utils/stream-utils');
const streamPool = require('../services/stream-pool-service');
const { logger } = require('../config/logger');

/**
 * Middleware para validar requests de streaming
 */
const validateStreamRequest = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    
    // Verificar se é um request válido para streaming
    if (!StreamUtils.supportsStreaming(req)) {
        logger.warn('Invalid streaming request', {
            userAgent,
            ip: req.ip,
            endpoint: req.originalUrl
        });
        
        return res.status(400).json({
            success: false,
            message: 'Cliente não suporta streaming de vídeo'
        });
    }
    
    next();
};

/**
 * Middleware para logging de streams com pool tracking
 */
const logStreamAccess = (req, res, next) => {
    const start = Date.now();
    const streamId = req.params.streamId;
    
    // Registrar início do acesso
    logger.info('Stream access started', {
        streamId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        range: req.get('Range') || 'full',
        method: req.method
    });
    
    // Interceptar o final da resposta
    const originalSend = res.send;
    const originalEnd = res.end;
    
    const logResponse = () => {
        const duration = Date.now() - start;
        
        logger.info('Stream access completed', {
            streamId,
            ip: req.ip,
            statusCode: res.statusCode,
            duration,
            bytesTransferred: res.get('Content-Length') || 'unknown',
            range: req.get('Range') || 'full'
        });
    };
    
    res.send = function(data) {
        logResponse();
        originalSend.call(this, data);
    };
    
    res.end = function(data) {
        logResponse();
        originalEnd.call(this, data);
    };
    
    // Cleanup quando cliente desconectar
    req.on('close', () => {
        logger.info('Stream client disconnected', {
            streamId,
            ip: req.ip,
            duration: Date.now() - start
        });
    });

    req.on('aborted', () => {
        logger.info('Stream request aborted', {
            streamId,
            ip: req.ip,
            duration: Date.now() - start
        });
    });
    
    next();
};

/**
 * Middleware para rate limiting de streams com pool
 */
const streamRateLimit = (req, res, next) => {
    const clientIP = req.ip;
    const streamId = req.params.streamId;
    
    try {
        // Verificar limite global de conexões por IP
        const streamStats = streamPool.getStats();
        const maxGlobalConnections = parseInt(process.env.MAX_GLOBAL_STREAM_CONNECTIONS) || 50;
        
        if (streamStats.totalConnections >= maxGlobalConnections) {
            logger.warn('Global stream limit reached', {
                totalConnections: streamStats.totalConnections,
                maxGlobalConnections,
                clientIP
            });
            
            return res.status(429).json({
                success: false,
                message: 'Limite global de streams atingido',
                retryAfter: 300
            });
        }

        // Verificar conexões do IP específico
        const ipConnections = Array.from(streamPool.activeStreams.values())
            .reduce((count, stream) => {
                return count + Array.from(stream.connections.values())
                    .filter(conn => conn.ip === clientIP).length;
            }, 0);

        const maxConnectionsPerIP = parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 5;
        
        if (ipConnections >= maxConnectionsPerIP) {
            logger.warn('IP stream limit exceeded', {
                clientIP,
                currentConnections: ipConnections,
                maxConnectionsPerIP
            });
            
            return res.status(429).json({
                success: false,
                message: 'Limite de streams por IP excedido',
                retryAfter: 300
            });
        }

        next();
    } catch (error) {
        logger.error('Stream rate limit check failed', {
            error: error.message,
            clientIP,
            streamId
        });
        
        // Permitir em caso de erro para não bloquear streams válidos
        next();
    }
};

/**
 * Middleware para headers de segurança em streams
 */
const streamSecurityHeaders = (req, res, next) => {
    // Headers de segurança específicos para streaming
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cache-Control': 'public, max-age=3600',
        'Vary': 'Accept-Encoding, Range'
    });
    
    // Permitir CORS para players de vídeo
    const origin = req.get('Origin');
    if (origin) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Range, Accept-Encoding, Accept, User-Agent');
        res.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
        res.set('Access-Control-Max-Age', '86400'); // 24 horas
    }
    
    next();
};

/**
 * Middleware para conexão de stream com timeout
 */
const streamConnectionManager = (req, res, next) => {
    const streamId = req.params.streamId;
    const connectionTimeout = parseInt(process.env.STREAM_CONNECTION_TIMEOUT) || 30000;
    
    // Configurar timeout de conexão
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            logger.warn('Stream connection timeout', {
                streamId,
                ip: req.ip,
                timeout: connectionTimeout
            });
            
            res.status(408).json({
                success: false,
                message: 'Timeout de conexão de stream'
            });
        }
    }, connectionTimeout);
    
    // Limpar timeout quando resposta for enviada
    const originalSend = res.send;
    const originalEnd = res.end;
    
    res.send = function(data) {
        clearTimeout(timeout);
        originalSend.call(this, data);
    };
    
    res.end = function(data) {
        clearTimeout(timeout);
        originalEnd.call(this, data);
    };
    
    // Limpar timeout em caso de erro
    res.on('error', () => {
        clearTimeout(timeout);
    });
    
    next();
};

/**
 * Middleware para health check de stream
 */
const streamHealthCheck = (req, res, next) => {
    const streamId = req.params.streamId;
    
    // Verificar se stream existe no pool
    const streamInfo = streamPool.getStreamInfo(streamId);
    
    if (!streamInfo) {
        return res.status(404).json({
            success: false,
            message: 'Stream não encontrado ou expirou',
            suggestion: 'Inicie um novo stream'
        });
    }
    
    // Verificar se stream não está sobrecarregado
    const maxConnectionsPerStream = parseInt(process.env.MAX_CONNECTIONS_PER_STREAM) || 10;
    
    if (streamInfo.connectionCount >= maxConnectionsPerStream) {
        return res.status(503).json({
            success: false,
            message: 'Stream temporariamente indisponível',
            reason: 'Muitas conexões ativas',
            retryAfter: 60
        });
    }
    
    next();
};

module.exports = {
    validateStreamRequest,
    logStreamAccess,
    streamRateLimit,
    streamSecurityHeaders,
    streamConnectionManager,
    streamHealthCheck
};