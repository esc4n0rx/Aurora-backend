const ProxyUtils = require('../utils/proxy-utils');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');
const { logger } = require('../config/logger');

/**
 * Middleware para validar requisições de proxy
 */
const validateProxyRequest = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    const clientInfo = ProxyUtils.parseUserAgent(userAgent);
    
    // Adicionar informações do cliente ao request
    req.clientInfo = clientInfo;
    
    // Log da tentativa de acesso
    logger.info('Proxy request received', {
        ip: req.ip,
        userAgent,
        clientType: clientInfo.type,
        player: clientInfo.player,
        endpoint: req.originalUrl
    });
    
    next();
};

/**
 * Middleware para rate limiting específico de proxy
 */
const proxyRateLimit = (req, res, next) => {
    const clientIP = req.ip;
    const maxRequestsPerMinute = parseInt(process.env.PROXY_RATE_LIMIT) || 60;
    
    // Implementação simples de rate limiting em memória
    if (!global.proxyRateLimitStore) {
        global.proxyRateLimitStore = new Map();
    }
    
    const now = Date.now();
    const windowStart = now - 60000; // 1 minuto
    
    // Limpar entradas antigas
    for (const [ip, requests] of global.proxyRateLimitStore) {
        const validRequests = requests.filter(time => time > windowStart);
        if (validRequests.length === 0) {
            global.proxyRateLimitStore.delete(ip);
        } else {
            global.proxyRateLimitStore.set(ip, validRequests);
        }
    }
    
    // Verificar limite do IP atual
    const currentRequests = global.proxyRateLimitStore.get(clientIP) || [];
    const validCurrentRequests = currentRequests.filter(time => time > windowStart);
    
    if (validCurrentRequests.length >= maxRequestsPerMinute) {
        logger.warn('Proxy rate limit exceeded', {
            ip: clientIP,
            requests: validCurrentRequests.length,
            limit: maxRequestsPerMinute
        });
        
        return res.status(429).json({
            success: false,
            message: 'Muitas requisições de streaming',
            retryAfter: 60
        });
    }
    
    // Registrar nova requisição
    validCurrentRequests.push(now);
    global.proxyRateLimitStore.set(clientIP, validCurrentRequests);
    
    next();
};

/**
 * Middleware para headers de segurança específicos do proxy
 */
const proxySecurityHeaders = (req, res, next) => {
    // Headers de segurança para streaming
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Proxy-Server': 'Aurora+ Proxy/1.0'
    });
    
    // CORS específico para streaming
    const origin = req.get('Origin');
    if (origin) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Range, Accept-Encoding, Accept, User-Agent, Authorization');
        res.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
        res.set('Access-Control-Max-Age', '86400');
    }
    
    // Permitir credenciais para streaming autenticado
    res.set('Access-Control-Allow-Credentials', 'true');
    
    next();
};

/**
 * Middleware para logging de streaming
 */
const logProxyAccess = (req, res, next) => {
    const start = Date.now();
    const proxyId = req.params.proxyId || req.params.encodedUrl;
    
    // Interceptar o final da resposta
    const originalSend = res.send;
    const originalEnd = res.end;
    
    const logResponse = async () => {
        const duration = Date.now() - start;
        const bytesTransferred = res.get('Content-Length') || 'unknown';
        
        try {
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.STREAM_ACCESS,
                description: 'Proxy stream accessed',
                metadata: {
                    proxyId,
                    duration,
                    bytesTransferred,
                    statusCode: res.statusCode,
                    clientType: req.clientInfo?.type,
                    player: req.clientInfo?.player,
                    hasRange: !!req.get('Range')
                },
                request: req,
                statusCode: res.statusCode
            });
        } catch (logError) {
            logger.error('Failed to log proxy access', {
                error: logError.message,
                proxyId
            });
        }
        
        logger.info('Proxy stream completed', {
            proxyId,
            ip: req.ip,
            statusCode: res.statusCode,
            duration,
            bytesTransferred,
            clientType: req.clientInfo?.type
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
    
    // Log quando cliente desconectar
    req.on('close', () => {
        logger.info('Proxy client disconnected', {
            proxyId,
            ip: req.ip,
            duration: Date.now() - start
        });
    });

    req.on('aborted', () => {
        logger.info('Proxy request aborted', {
            proxyId,
            ip: req.ip,
            duration: Date.now() - start
        });
    });
    
    next();
};

/**
 * Middleware para tratar OPTIONS requests
 */
const handleProxyOptions = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.set({
            'Access-Control-Allow-Origin': req.get('Origin') || '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Accept-Encoding, Accept, User-Agent, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        
        return res.status(200).end();
    }
    
    next();
};

/**
 * Middleware para timeout de streaming
 */
const proxyTimeout = (req, res, next) => {
    const timeout = parseInt(process.env.PROXY_STREAM_TIMEOUT) || 300000; // 5 minutos
    
    const timeoutHandle = setTimeout(() => {
        if (!res.headersSent) {
            logger.warn('Proxy stream timeout', {
                ip: req.ip,
                endpoint: req.originalUrl,
                timeout
            });
            
            res.status(408).json({
                success: false,
                message: 'Timeout no streaming'
            });
        }
    }, timeout);
    
    // Limpar timeout quando resposta for enviada
    const originalSend = res.send;
    const originalEnd = res.end;
    
    res.send = function(data) {
        clearTimeout(timeoutHandle);
        originalSend.call(this, data);
    };
    
    res.end = function(data) {
        clearTimeout(timeoutHandle);
        originalEnd.call(this, data);
    };
    
    // Limpar timeout em caso de erro
    res.on('error', () => {
        clearTimeout(timeoutHandle);
    });
    
    next();
};

/**
 * Middleware para validar proxy ID
 */
const validateProxyId = (req, res, next) => {
    const { proxyId } = req.params;
    
    if (!proxyId || typeof proxyId !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'ID do proxy inválido'
        });
    }
    
    // Validar formato do proxy ID
    if (!/^[a-zA-Z0-9_-]+$/.test(proxyId)) {
        return res.status(400).json({
            success: false,
            message: 'Formato do ID do proxy inválido'
        });
    }
    
    next();
};

module.exports = {
    validateProxyRequest,
    proxyRateLimit,
    proxySecurityHeaders,
    logProxyAccess,
    handleProxyOptions,
    proxyTimeout,
    validateProxyId
};