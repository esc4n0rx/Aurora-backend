const { supabaseAdmin } = require('../config/database');

class ContentViewModel {
    /**
     * Registrar visualização de conteúdo
     */
    static async create(viewData) {
        const { data, error } = await supabaseAdmin
            .from('content_views')
            .insert([viewData])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Verificar se IP já visualizou conteúdo recentemente
     */
    static async hasRecentView(contentId, ipAddress, minutesAgo = 30) {
        const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from('content_views')
            .select('id')
            .eq('content_id', contentId)
            .eq('ip_address', ipAddress)
            .gte('created_at', cutoffTime)
            .limit(1);

        if (error) {
            throw error;
        }

        return data.length > 0;
    }

    /**
     * Obter visualizações de um conteúdo
     */
    static async findByContentId(contentId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const { data, error, count } = await supabaseAdmin
            .from('content_views')
            .select('*', { count: 'exact' })
            .eq('content_id', contentId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

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
     * Obter estatísticas de visualização
     */
    static async getViewStats(contentId, timeRange = '7d') {
        let startDate;
        
        switch (timeRange) {
            case '1d':
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }

        const { data, error } = await supabaseAdmin
            .from('content_views')
            .select('created_at, view_duration, view_percentage')
            .eq('content_id', contentId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Obter visualizações únicas por IP
     */
    static async getUniqueViews(contentId) {
        const { data, error } = await supabaseAdmin
            .from('content_views')
            .select('ip_address, count(*)')
            .eq('content_id', contentId);

        if (error) {
            throw error;
        }

        return data;
    }
}

module.exports = ContentViewModel;