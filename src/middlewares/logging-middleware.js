const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');

/**
 * Middleware para log automático baseado em configuração
 */
const autoLog = (actionType, options = {}) => {
    return LoggingService.createRouteLogger(actionType, options);
};

/**
 * Middleware para log de tentativas de acesso com token inválido
 */
const logInvalidToken = async (req, res, next) => {
    // Verificar se há tentativa de token
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        await LoggingService.logUserAction({
            actionType: ACTION_TYPES.INVALID_TOKEN,
            description: 'Invalid or expired token attempt',
            metadata: {
                endpoint: req.originalUrl,
                tokenProvided: !!authHeader
            },
            request: req,
            statusCode: 401
        });
    }
    next();
};

/**
 * Middleware para detectar rate limiting
 */
const logRateLimit = async (req, res, next) => {
    const clientIP = LoggingService.getClientIP(req);
    
    // Verificar atividade suspeita
    const isSuspicious = await LoggingService.detectSuspiciousActivity(clientIP);
    
    if (isSuspicious) {
        return res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
            retryAfter: 3600 // 1 hora
        });
    }
    
    next();
};

/**
 * Middleware para log de saúde da API
 */
const logHealthCheck = autoLog(ACTION_TYPES.API_HEALTH_CHECK, {
    description: 'API health check accessed'
});

/**
 * Middleware para log de acesso à documentação
 */
const logDocsAccess = autoLog(ACTION_TYPES.API_DOCS_ACCESS, {
    description: 'API documentation accessed'
});

module.exports = {
    autoLog,
    logInvalidToken,
    logRateLimit,
    logHealthCheck,
    logDocsAccess
};