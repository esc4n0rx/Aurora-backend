const HealthService = require('../services/health-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');

class HealthController {
    /**
     * Health check básico para load balancers
     */
    static async basicHealth(req, res, next) {
        try {
            const health = await HealthService.getBasicHealthStatus();
            
            const statusCode = health.status === 'healthy' ? 200 : 503;
            
            res.status(statusCode).json({
                success: health.status === 'healthy',
                ...health
            });
        } catch (error) {
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                message: 'Health check failed',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Health check completo com métricas detalhadas
     */
    static async fullHealth(req, res, next) {
        try {
            const health = await HealthService.getFullHealthStatus();
            
            // Log do acesso ao health check
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.API_HEALTH_CHECK,
                description: 'Full health check accessed',
                metadata: {
                    overallStatus: health.status,
                    responseTime: health.responseTime
                },
                request: req,
                statusCode: 200
            });

            const statusCode = health.status === 'critical' ? 503 : 200;
            
            res.status(statusCode).json({
                success: health.status !== 'critical',
                ...health
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.API_HEALTH_CHECK,
                description: 'Health check failed',
                metadata: {
                    error: error.message
                },
                request: req,
                statusCode: 503
            });

            res.status(503).json({
                success: false,
                status: 'critical',
                message: 'Health check failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Endpoint de readiness para Kubernetes
     */
    static async readiness(req, res, next) {
        try {
            const health = await HealthService.getBasicHealthStatus();
            
            if (health.status === 'healthy') {
                res.status(200).json({ status: 'ready' });
            } else {
                res.status(503).json({ status: 'not ready' });
            }
        } catch (error) {
            res.status(503).json({ status: 'not ready' });
        }
    }

    /**
     * Endpoint de liveness para Kubernetes
     */
    static async liveness(req, res, next) {
        try {
            // Verificação simples - se o processo está rodando
            res.status(200).json({ 
                status: 'alive',
                uptime: process.uptime()
            });
        } catch (error) {
            res.status(503).json({ status: 'dead' });
        }
    }
}

module.exports = HealthController;