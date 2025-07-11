const { supabaseAdmin } = require('../config/database');

class ContentModel {
    /**
     * Criar novo conteúdo
     */
    static async create(contentData) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .insert([contentData])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar conteúdo por ID
     */
    static async findById(id) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data;
    }

    /**
     * Listar conteúdos com filtros
     */
    static async findMany(filters = {}) {
        const {
            categoria,
            subcategoria,
            ativo,
            rating_min,
            rating_max,
            temporada,
            limit = 20,
            offset = 0,
            search,
            sort_by = 'created_at',
            sort_order = 'desc'
        } = filters;

        let query = supabaseAdmin
            .from('contents')
            .select('*', { count: 'exact' });

        // Filtros
        if (categoria) query = query.eq('categoria', categoria);
        if (subcategoria) query = query.eq('subcategoria', subcategoria);
        if (ativo !== undefined) query = query.eq('ativo', ativo);
        if (rating_min !== undefined) query = query.gte('rating', rating_min);
        if (rating_max !== undefined) query = query.lte('rating', rating_max);
        if (temporada) query = query.eq('temporada', temporada);
        
        // Busca textual
        if (search) {
            query = query.ilike('nome', `%${search}%`);
        }

        // Ordenação
        query = query.order(sort_by, { ascending: sort_order === 'asc' });

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
     * Atualizar conteúdo
     */
    static async update(id, updateData) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Excluir conteúdo
     */
    static async delete(id) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar conteúdos mais populares
     */
    static async findPopular(limit = 10) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('*')
            .eq('ativo', true)
            .order('total_visualizations', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar episódios de uma série
     */
    static async findEpisodesBySeries(nome, temporada = null) {
        let query = supabaseAdmin
            .from('contents')
            .select('*')
            .eq('nome', nome)
            .in('subcategoria', ['serie', 'anime', 'minisserie'])
            .order('temporada', { ascending: true })
            .order('episodio', { ascending: true });

        if (temporada) {
            query = query.eq('temporada', temporada);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Obter estatísticas de conteúdo
     */
    static async getStats() {
        try {
            // Buscar todos os conteúdos ativos e agrupar por categoria manualmente
            const { data: contents, error: contentsError } = await supabaseAdmin
                .from('contents')
                .select('categoria, total_visualizations')
                .eq('ativo', true);

            if (contentsError) {
                throw contentsError;
            }

            // Agrupar por categoria manualmente
            const categoryStats = {};
            let totalViews = 0;

            contents.forEach(content => {
                // Contar por categoria
                if (categoryStats[content.categoria]) {
                    categoryStats[content.categoria]++;
                } else {
                    categoryStats[content.categoria] = 1;
                }

                // Somar visualizações
                totalViews += content.total_visualizations || 0;
            });

            // Converter objeto para array no formato esperado
            const categoryStatsArray = Object.entries(categoryStats).map(([categoria, count]) => ({
                categoria,
                count
            }));

            return {
                categoryStats: categoryStatsArray,
                totalViews
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = ContentModel;