const StreamUtils = require('../utils/stream-utils');
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
 * Middleware para logging de streams
 */
const logStreamAccess = (req, res, next) => {
    const start = Date.now();
    
    // Interceptar o final da resposta
    const originalSend = res.send;
    const originalEnd = res.end;
    
    const logResponse = () => {
        const duration = Date.now() - start;
        const range = req.get('Range');
        
        logger.info('Stream access', {
            contentId: req.params.contentId,
            streamId: req.params.streamId,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            range: range || 'full',
            statusCode: res.statusCode,
            duration,
            bytesTransferred: res.get('Content-Length') || 'unknown'
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
    
    next();
};

/**
 * Middleware para rate limiting de streams
 */
const streamRateLimit = (req, res, next) => {
    const clientIP = req.ip;
    const now = Date.now();
    
    // Implementação simples de rate limiting em memória
    if (!streamRateLimit.clients) {
        streamRateLimit.clients = new Map();
    }
    
    const clientData = streamRateLimit.clients.get(clientIP) || {
        requests: [],
        lastCleanup: now
    };
    
    // Limpar requests antigos (últimos 10 minutos)
    const tenMinutesAgo = now - (10 * 60 * 1000);
    clientData.requests = clientData.requests.filter(time => time > tenMinutesAgo);
    
    // Verificar limite (máximo 10 streams simultâneos por IP)
    if (clientData.requests.length >= 10) {
        logger.warn('Stream rate limit exceeded', {
            ip: clientIP,
            requests: clientData.requests.length
        });
        
        return res.status(429).json({
            success: false,
            message: 'Limite de streams simultâneos excedido',
            retryAfter: 600 // 10 minutos
        });
    }
    
    // Adicionar request atual
    clientData.requests.push(now);
    streamRateLimit.clients.set(clientIP, clientData);
    
    // Cleanup periódico
    if (now - clientData.lastCleanup > 60000) { // A cada 1 minuto
        clientData.lastCleanup = now;
        
        // Remover clientes inativos
        for (const [ip, data] of streamRateLimit.clients) {
            if (data.requests.length === 0) {
                streamRateLimit.clients.delete(ip);
            }
        }
    }
    
    next();
};

/**
 * Middleware para headers de segurança em streams
 */
const streamSecurityHeaders = (req, res, next) => {
    // Headers de segurança específicos para streaming
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    
    // Permitir CORS para players de vídeo
    const origin = req.get('Origin');
    if (origin) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Range, Accept-Encoding, Accept');
        res.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    }
    
    next();
};

module.exports = {
    validateStreamRequest,
    logStreamAccess,
    streamRateLimit,
    streamSecurityHeaders
};