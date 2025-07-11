const UserModel = require('../models/user-model');
const UserActionModel = require('../models/user-action-model');
const { logger } = require('../config/logger');

class AdminService {
    /**
     * Listar usuários com filtros e paginação
     */
    static async listUsers(filters = {}) {
        const {
            limit = 20,
            offset = 0,
            search = null,
            status = 'all', // all, active, blocked, deleted
            sort_by = 'created_at',
            sort_order = 'desc'
        } = filters;

        try {
            const result = await UserModel.findManyWithFilters({
                search,
                status,
                limit,
                offset,
                sort_by,
                sort_order
            });

            return result;
        } catch (error) {
            logger.error('Failed to list users', {
                filters,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter usuário por ID com detalhes
     */
    static async getUserDetails(userId) {
        try {
            const user = await UserModel.findByIdWithDetails(userId);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            return user;
        } catch (error) {
            logger.error('Failed to get user details', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Bloquear usuário
     */
    static async blockUser(userId, reason, adminUserId) {
        try {
            // Verificar se usuário existe e não está deletado
            const user = await UserModel.findById(userId);
            if (!user || user.is_deleted) {
                throw new Error('Usuário não encontrado');
            }

            if (user.is_blocked) {
                throw new Error('Usuário já está bloqueado');
            }

            // Não permitir bloquear admin
            if (userId === process.env.ADMIN_USER_ID) {
                throw new Error('Não é possível bloquear o usuário administrador');
            }

            const result = await UserModel.blockUser(userId, reason, adminUserId);
            
            logger.info('User blocked by admin', {
                userId,
                reason,
                adminUserId,
                blockedAt: result.blocked_at
            });

            return result;
        } catch (error) {
            logger.error('Failed to block user', {
                userId,
                reason,
                adminUserId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Desbloquear usuário
     */
    static async unblockUser(userId, adminUserId) {
        try {
            // Verificar se usuário existe e está bloqueado
            const user = await UserModel.findById(userId);
            if (!user || user.is_deleted) {
                throw new Error('Usuário não encontrado');
            }

            if (!user.is_blocked) {
                throw new Error('Usuário não está bloqueado');
            }

            const result = await UserModel.unblockUser(userId, adminUserId);
            
            logger.info('User unblocked by admin', {
                userId,
                adminUserId,
                unblockedAt: new Date().toISOString()
            });

            return result;
        } catch (error) {
            logger.error('Failed to unblock user', {
                userId,
                adminUserId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Remover usuário (soft delete)
     */
    static async deleteUser(userId, adminUserId) {
        try {
            // Verificar se usuário existe e não está deletado
            const user = await UserModel.findById(userId);
            if (!user || user.is_deleted) {
                throw new Error('Usuário não encontrado');
            }

            // Não permitir deletar admin
            if (userId === process.env.ADMIN_USER_ID) {
                throw new Error('Não é possível remover o usuário administrador');
            }

            const result = await UserModel.deleteUser(userId, adminUserId);
            
            logger.info('User deleted by admin', {
                userId,
                adminUserId,
                deletedAt: result.deleted_at
            });

            return result;
        } catch (error) {
            logger.error('Failed to delete user', {
                userId,
                adminUserId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Restaurar usuário deletado
     */
    static async restoreUser(userId, adminUserId) {
        try {
            // Verificar se usuário existe e está deletado
            const user = await UserModel.findByIdIncludingDeleted(userId);
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            if (!user.is_deleted) {
                throw new Error('Usuário não está removido');
            }

            const result = await UserModel.restoreUser(userId, adminUserId);
            
            logger.info('User restored by admin', {
                userId,
                adminUserId,
                restoredAt: new Date().toISOString()
            });

            return result;
        } catch (error) {
            logger.error('Failed to restore user', {
                userId,
                adminUserId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter logs do sistema com filtros
     */
    static async getLogs(filters = {}) {
        const {
            limit = 50,
            offset = 0,
            userId = null,
            actionCategory = null,
            actionType = null,
            startDate = null,
            endDate = null,
            ipAddress = null,
            statusCode = null
        } = filters;

        try {
            const result = await UserActionModel.findWithFilters({
                userId,
                actionCategory,
                actionType,
                startDate,
                endDate,
                ipAddress,
                statusCode,
                limit,
                offset
            });

            return result;
        } catch (error) {
            logger.error('Failed to get logs', {
                filters,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter estatísticas de logs
     */
    static async getLogsStats(timeRange = '7d') {
        try {
            const stats = await UserActionModel.getActionStats({
                timeRange,
                groupBy: 'action_category'
            });

            const topUsers = await UserActionModel.getTopActiveUsers(10, timeRange);
            const topIPs = await UserActionModel.getTopActiveIPs(10, timeRange);

            return {
                actionStats: stats,
                topUsers,
                topIPs,
                timeRange
            };
        } catch (error) {
            logger.error('Failed to get logs stats', {
                timeRange,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter estatísticas gerais do sistema
     */
    static async getSystemStats() {
        try {
            const [userStats, contentStats, activityStats] = await Promise.all([
                this.getUserStats(),
                this.getContentStats(),
                this.getActivityStats()
            ]);

            return {
                users: userStats,
                content: contentStats,
                activity: activityStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Failed to get system stats', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Estatísticas de usuários
     */
    static async getUserStats() {
        return await UserModel.getUserStats();
    }

    /**
     * Estatísticas de conteúdo
     */
    static async getContentStats() {
        const ContentModel = require('../models/content-model');
        return await ContentModel.getStats();
    }

    /**
     * Estatísticas de atividade
     */
    static async getActivityStats() {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [actions24h, actions7d, uniqueIPs24h] = await Promise.all([
            UserActionModel.getActionCount(last24h),
            UserActionModel.getActionCount(last7d),
            UserActionModel.getUniqueIPCount(last24h)
        ]);

        return {
            actionsLast24h: actions24h,
            actionsLast7d: actions7d,
            uniqueIPsLast24h: uniqueIPs24h
        };
    }
}

module.exports = AdminService;