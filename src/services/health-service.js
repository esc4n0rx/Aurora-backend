const SystemUtils = require('../utils/system-utils');
const { supabaseAdmin } = require('../config/database');
const { logger } = require('../config/logger');

class HealthService {
    /**
     * Obter status completo da aplicação
     */
    static async getFullHealthStatus() {
        try {
            const startTime = Date.now();

            // Verificações paralelas para otimização
            const [databaseHealth, systemInfo, memoryUsage, cpuUsage] = await Promise.all([
                SystemUtils.checkDatabaseHealth(),
                Promise.resolve(SystemUtils.getSystemInfo()),
                Promise.resolve(SystemUtils.getMemoryUsage()),
                Promise.resolve(SystemUtils.getCPUUsage())
            ]);

            const totalResponseTime = Date.now() - startTime;

            // Verificações adicionais
            const diskUsage = SystemUtils.getDiskUsage();
            
            // Estatísticas da aplicação
            const appStats = await this.getApplicationStats();

            const healthChecks = {
                database: databaseHealth,
                memory: memoryUsage,
                cpu: cpuUsage,
                disk: diskUsage
            };

            const overallStatus = SystemUtils.determineOverallHealth(healthChecks);

            return {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                responseTime: totalResponseTime,
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                system: systemInfo,
                resources: {
                    memory: memoryUsage,
                    cpu: cpuUsage,
                    disk: diskUsage
                },
                services: {
                    database: databaseHealth
                },
                application: appStats
            };
        } catch (error) {
            logger.error('Health check failed', {
                error: error.message,
                stack: error.stack
            });

            return {
                status: 'critical',
                timestamp: new Date().toISOString(),
                error: error.message,
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            };
        }
    }

    /**
     * Health check básico para load balancers
     */
    static async getBasicHealthStatus() {
        try {
            const dbHealth = await SystemUtils.checkDatabaseHealth();
            
            if (dbHealth.status === 'unhealthy') {
                return {
                    status: 'unhealthy',
                    message: 'Database connection failed'
                };
            }

            return {
                status: 'healthy',
                message: 'Service is operational',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Obter estatísticas da aplicação
     */
    static async getApplicationStats() {
        try {
            // Contadores básicos
            const [usersCount, profilesCount, contentCount, actionsCount] = await Promise.all([
                this.getUsersCount(),
                this.getProfilesCount(),
                this.getContentCount(),
                this.getActionsCount()
            ]);

            return {
                users: {
                    total: usersCount.total,
                    active: usersCount.active,
                    blocked: usersCount.blocked
                },
                profiles: {
                    total: profilesCount.total,
                    active: profilesCount.active
                },
                content: {
                    total: contentCount.total,
                    active: contentCount.active
                },
                actions: {
                    total: actionsCount.total,
                    last24h: actionsCount.last24h
                }
            };
        } catch (error) {
            logger.error('Failed to get application stats', {
                error: error.message
            });
            
            return {
                error: 'Failed to retrieve application statistics'
            };
        }
    }

    /**
     * Contar usuários
     */
    static async getUsersCount() {
        const { data: total } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
            .is('is_deleted', false);

        const { data: active } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
            .is('is_deleted', false)
            .is('is_blocked', false);

        const { data: blocked } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
            .is('is_deleted', false)
            .eq('is_blocked', true);

        return {
            total: total.length,
            active: active.length,
            blocked: blocked.length
        };
    }

    /**
     * Contar perfis
     */
    static async getProfilesCount() {
        const { data: total } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact' });

        const { data: active } = await supabaseAdmin
            .from('profiles')
            .select('*', { count: 'exact' })
            .eq('is_active', true);

        return {
            total: total.length,
            active: active.length
        };
    }

    /**
     * Contar conteúdos
     */
    static async getContentCount() {
        const { data: total } = await supabaseAdmin
            .from('contents')
            .select('*', { count: 'exact' });

        const { data: active } = await supabaseAdmin
            .from('contents')
            .select('*', { count: 'exact' })
            .eq('ativo', true);

        return {
            total: total.length,
            active: active.length
        };
    }

    /**
     * Contar ações
     */
    static async getActionsCount() {
        const { data: total } = await supabaseAdmin
            .from('user_actions')
            .select('*', { count: 'exact' });

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: last24h } = await supabaseAdmin
            .from('user_actions')
            .select('*', { count: 'exact' })
            .gte('created_at', yesterday);

        return {
            total: total.length,
            last24h: last24h.length
        };
    }
}

module.exports = HealthService;