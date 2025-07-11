const { supabaseAdmin } = require('../config/database');

class UserActionModel {
    /**
     * Registrar uma ação do usuário
     */
    static async create(actionData) {
        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .insert([actionData])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar ações por usuário
     */
    static async findByUserId(userId, options = {}) {
        const {
            limit = 50,
            offset = 0,
            actionCategory = null,
            actionType = null,
            startDate = null,
            endDate = null
        } = options;

        let query = supabaseAdmin
            .from('user_actions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (actionCategory) {
            query = query.eq('action_category', actionCategory);
        }

        if (actionType) {
            query = query.eq('action_type', actionType);
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar logs com filtros avançados (para admin)
     */
    static async findWithFilters(filters) {
        const {
            userId,
            actionCategory,
            actionType,
            startDate,
            endDate,
            ipAddress,
            statusCode,
            limit,
            offset
        } = filters;

        let query = supabaseAdmin
            .from('user_actions')
            .select(`
                *,
                users:user_id (
                    nome,
                    email
                ),
                profiles:profile_id (
                    nome
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (actionCategory) {
            query = query.eq('action_category', actionCategory);
        }

        if (actionType) {
            query = query.eq('action_type', actionType);
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        if (ipAddress) {
            query = query.eq('ip_address', ipAddress);
        }

        if (statusCode) {
            query = query.eq('status_code', statusCode);
        }

        // Paginação
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        return {
            data,
            total: count,
            limit,
            offset
        };
    }

    /**
     * Obter estatísticas de ações
     */
    static async getActionStats(options = {}) {
        const {
            userId = null,
            startDate = null,
            endDate = null,
            groupBy = 'action_type',
            timeRange = '7d'
        } = options;

        // Calcular data de início se timeRange fornecido
        let calculatedStartDate = startDate;
        if (!startDate && timeRange) {
            const days = parseInt(timeRange.replace('d', ''));
            calculatedStartDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        }

        let query = supabaseAdmin
            .from('user_actions')
            .select(`${groupBy}, count(*)`);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (calculatedStartDate) {
            query = query.gte('created_at', calculatedStartDate);
        }

        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar ações recentes por IP (detecção de atividade suspeita)
     */
    static async findRecentByIP(ipAddress, minutes = 60) {
        const startTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .select('*')
            .eq('ip_address', ipAddress)
            .gte('created_at', startTime)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Obter usuários mais ativos
     */
    static async getTopActiveUsers(limit = 10, timeRange = '7d') {
        const days = parseInt(timeRange.replace('d', ''));
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .select(`
                user_id,
                users:user_id (nome, email),
                count(*)
            `)
            .gte('created_at', startDate)
            .not('user_id', 'is', null)
            .limit(limit);

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Obter IPs mais ativos
     */
    static async getTopActiveIPs(limit = 10, timeRange = '7d') {
        const days = parseInt(timeRange.replace('d', ''));
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .select(`
                ip_address,
                count(*)
            `)
            .gte('created_at', startDate)
            .not('ip_address', 'is', null)
            .limit(limit);

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Contar ações em um período
     */
    static async getActionCount(startDate) {
        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .select('*', { count: 'exact' })
            .gte('created_at', startDate);

        if (error) {
            throw error;
        }

        return data.length;
    }

    /**
     * Contar IPs únicos em um período
     */
    static async getUniqueIPCount(startDate) {
        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .select('ip_address')
            .gte('created_at', startDate)
            .not('ip_address', 'is', null);

        if (error) {
            throw error;
        }

        const uniqueIPs = new Set(data.map(action => action.ip_address));
        return uniqueIPs.size;
    }

    /**
     * Deletar ações antigas (limpeza de dados)
     */
    static async deleteOldActions(daysOld = 90) {
        const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('user_actions')
            .delete()
            .lt('created_at', cutoffDate);

        if (error) {
            throw error;
        }

        return data;
    }
}

module.exports = UserActionModel;