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
     * Obter estatísticas de ações
     */
    static async getActionStats(options = {}) {
        const {
            userId = null,
            startDate = null,
            endDate = null,
            groupBy = 'action_type'
        } = options;

        let query = supabaseAdmin
            .from('user_actions')
            .select(`${groupBy}, count(*)`);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
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