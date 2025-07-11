const AdminService = require('../services/admin-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');

class AdminController {
    /**
     * Listar usuários
     */
    static async listUsers(req, res, next) {
        try {
            const result = await AdminService.listUsers(req.query);
            
            // Log da listagem
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_LIST,
                description: 'Users listed by admin',
                metadata: {
                    filters: req.query,
                    totalResults: result.total,
                    returnedCount: result.data.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Usuários obtidos com sucesso',
                data: result.data,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.offset + result.limit < result.total
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter detalhes de um usuário
     */
    static async getUserDetails(req, res, next) {
        try {
            const { userId } = req.params;
            const user = await AdminService.getUserDetails(userId);
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_ACCESS,
                description: 'User details accessed by admin',
                metadata: {
                    targetUserId: userId,
                    targetUserEmail: user.email
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Detalhes do usuário obtidos com sucesso',
                data: user
            });
        } catch (error) {
            if (error.message.includes('não encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Bloquear usuário
     */
    static async blockUser(req, res, next) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            
            const result = await AdminService.blockUser(userId, reason, req.user.userId);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_BLOCK,
                description: 'User blocked by admin',
                metadata: {
                    targetUserId: userId,
                    reason,
                    blockedAt: result.blocked_at
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Usuário bloqueado com sucesso',
                data: result
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_BLOCK,
                description: 'User block failed',
                metadata: {
                    targetUserId: req.params.userId,
                    reason: req.body.reason,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado') || 
                error.message.includes('já está bloqueado') ||
                error.message.includes('administrador')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Desbloquear usuário
     */
    static async unblockUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const result = await AdminService.unblockUser(userId, req.user.userId);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_UNBLOCK,
                description: 'User unblocked by admin',
                metadata: {
                    targetUserId: userId
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Usuário desbloqueado com sucesso',
                data: result
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_UNBLOCK,
                description: 'User unblock failed',
                metadata: {
                    targetUserId: req.params.userId,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado') || 
                error.message.includes('não está bloqueado')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Remover usuário
     */
    static async deleteUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const result = await AdminService.deleteUser(userId, req.user.userId);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_DELETE,
                description: 'User deleted by admin',
                metadata: {
                    targetUserId: userId,
                    deletedAt: result.deleted_at
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Usuário removido com sucesso',
                data: result
            });
        } catch (error) {
            // Log da falha
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_DELETE,
                description: 'User deletion failed',
                metadata: {
                    targetUserId: req.params.userId,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            if (error.message.includes('não encontrado') || 
                error.message.includes('administrador')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Restaurar usuário
     */
    static async restoreUser(req, res, next) {
        try {
            const { userId } = req.params;
            
            const result = await AdminService.restoreUser(userId, req.user.userId);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.USER_RESTORE,
                description: 'User restored by admin',
                metadata: {
                    targetUserId: userId
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Usuário restaurado com sucesso',
                data: result
            });
        } catch (error) {
            if (error.message.includes('não encontrado') || 
                error.message.includes('não está removido')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Obter logs do sistema
     */
    static async getLogs(req, res, next) {
        try {
            const result = await AdminService.getLogs(req.query);
            
            // Log do acesso aos logs
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.LOGS_ACCESS,
                description: 'System logs accessed by admin',
                metadata: {
                    filters: req.query,
                    totalResults: result.total,
                    returnedCount: result.data.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Logs obtidos com sucesso',
                data: result.data,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    offset: result.offset,
                    hasMore: result.offset + result.limit < result.total
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter estatísticas de logs
     */
    static async getLogsStats(req, res, next) {
        try {
            const { timeRange = '7d' } = req.query;
            const stats = await AdminService.getLogsStats(timeRange);
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.LOGS_STATS,
                description: 'Logs statistics accessed by admin',
                metadata: {
                    timeRange
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Estatísticas de logs obtidas com sucesso',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter estatísticas gerais do sistema
     */
    static async getSystemStats(req, res, next) {
        try {
            const stats = await AdminService.getSystemStats();
            
            // Log do acesso
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.SYSTEM_STATS,
                description: 'System statistics accessed by admin',
                metadata: {},
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Estatísticas do sistema obtidas com sucesso',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AdminController;