const UserActionModel = require('../models/user-action-model');
const { userActionLogger } = require('../config/logger');
const { getActionCategory } = require('../utils/action-types');
const crypto = require('crypto');

class LoggingService {
    /**
     * Registrar ação do usuário
     */
    static async logUserAction({
        userId = null,
        profileId = null,
        actionType,
        description = null,
        metadata = {},
        request = null,
        responseTime = null,
        statusCode = null
    }) {
        try {
            // Gerar ID único para a requisição
            const requestId = crypto.randomUUID();

            // Extrair informações da requisição se fornecida
            let ipAddress = null;
            let userAgent = null;
            let endpoint = null;
            let method = null;

            if (request) {
                ipAddress = this.getClientIP(request);
                userAgent = request.get('User-Agent');
                endpoint = request.originalUrl || request.url;
                method = request.method;
            }

            // Preparar dados da ação
            const actionData = {
                user_id: userId,
                profile_id: profileId,
                action_type: actionType,
                action_category: getActionCategory(actionType),
                description,
                metadata,
                ip_address: ipAddress,
                user_agent: userAgent,
                request_id: requestId,
                endpoint,
                method,
                status_code: statusCode,
                response_time_ms: responseTime
            };

            // Salvar no banco de dados (assíncrono)
            const savedAction = await UserActionModel.create(actionData);

            // Log estruturado
            userActionLogger.info(`${actionType} executed`, {
                userId,
                profileId,
                actionType,
                actionCategory: getActionCategory(actionType),
                description,
                metadata,
                ipAddress,
                endpoint,
                method,
                statusCode,
                responseTime,
                requestId
            });

            return savedAction;
        } catch (error) {
            // Se falhar ao salvar no banco, pelo menos loggar no arquivo
            userActionLogger.error('Failed to log user action', {
                actionType,
                userId,
                profileId,
                error: error.message,
                description,
                metadata
            });
            
            // Não throw o erro para não afetar a requisição principal
            console.error('Logging service error:', error);
        }
    }

    /**
     * Obter IP real do cliente
     */
    static getClientIP(request) {
        return request.ip ||
               request.connection?.remoteAddress ||
               request.socket?.remoteAddress ||
               request.connection?.socket?.remoteAddress ||
               request.headers['x-forwarded-for']?.split(',')[0] ||
               request.headers['x-real-ip'] ||
               request.headers['x-client-ip'] ||
               'unknown';
    }

    /**
     * Middleware para log automático de rotas
     */
    static createRouteLogger(actionType, options = {}) {
        return async (req, res, next) => {
            const startTime = Date.now();
            
            // Interceptar o final da resposta
            const originalSend = res.send;
            res.send = function(data) {
                const responseTime = Date.now() - startTime;
                
                // Log da ação (assíncrono)
                LoggingService.logUserAction({
                    userId: req.user?.userId || null,
                    profileId: req.params?.profileId || req.body?.profileId || null,
                    actionType,
                    description: options.description || `${req.method} ${req.originalUrl}`,
                    metadata: {
                        ...options.metadata,
                        query: req.query,
                        params: req.params,
                        bodyKeys: Object.keys(req.body || {})
                    },
                    request: req,
                    responseTime,
                    statusCode: res.statusCode
                }).catch(error => {
                    console.error('Route logging error:', error);
                });

                // Chamar o send original
                originalSend.call(this, data);
            };

            next();
        };
    }

    /**
     * Obter estatísticas de usuário
     */
    static async getUserStats(userId, options = {}) {
        try {
            return await UserActionModel.findByUserId(userId, options);
        } catch (error) {
            userActionLogger.error('Failed to get user stats', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Detectar atividade suspeita
     */
    static async detectSuspiciousActivity(ipAddress, threshold = 100) {
        try {
            const recentActions = await UserActionModel.findRecentByIP(ipAddress, 60);
            
            if (recentActions.length > threshold) {
                await this.logUserAction({
                    actionType: 'suspicious_activity',
                    description: `High activity detected from IP: ${ipAddress}`,
                    metadata: {
                        actionCount: recentActions.length,
                        threshold,
                        timeWindow: '60 minutes'
                    }
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            userActionLogger.error('Failed to detect suspicious activity', {
                ipAddress,
                error: error.message
            });
            return false;
        }
    }
}

module.exports = LoggingService;