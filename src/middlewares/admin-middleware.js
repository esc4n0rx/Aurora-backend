const { logger } = require('../config/logger');

/**
 * Middleware para verificar se o usuário é administrador
 */
const requireAdmin = (req, res, next) => {
    try {
        const adminUserId = process.env.ADMIN_USER_ID;
        
        if (!adminUserId) {
            logger.error('Admin user ID not configured', {
                endpoint: req.originalUrl,
                method: req.method
            });
            
            return res.status(500).json({
                success: false,
                message: 'Configuração de administrador não encontrada'
            });
        }

        // Verificar se o usuário autenticado é o admin
        if (req.user.userId !== adminUserId) {
            logger.warn('Unauthorized admin access attempt', {
                userId: req.user.userId,
                adminUserId,
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Apenas administradores podem acessar este recurso.'
            });
        }

        // Log de acesso autorizado
        logger.info('Admin access granted', {
            userId: req.user.userId,
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip
        });

        next();
    } catch (error) {
        logger.error('Admin middleware error', {
            error: error.message,
            userId: req.user?.userId,
            endpoint: req.originalUrl
        });
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

module.exports = {
    requireAdmin
};