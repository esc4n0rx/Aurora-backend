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
     * Listar conteúdos com filtros expandidos
     */
    static async findMany(filters = {}) {
        const {
            categoria,
            subcategoria,
            ativo,
            rating_min,
            rating_max,
            temporada,
            status_serie,
            tmdb_hit,
            serie_nome,
            limit = 20,
            offset = 0,
            search,
            sort_by = 'created_at',
            sort_order = 'desc'
        } = filters;

        let query = supabaseAdmin
            .from('contents')
            .select('*', { count: 'exact' });

        // Filtros básicos
        if (categoria) query = query.eq('categoria', categoria);
        if (subcategoria) query = query.eq('subcategoria', subcategoria);
        if (ativo !== undefined) query = query.eq('ativo', ativo);
        if (rating_min !== undefined) query = query.gte('rating', rating_min);
        if (rating_max !== undefined) query = query.lte('rating', rating_max);
        if (temporada) query = query.eq('temporada', temporada);
        if (status_serie) query = query.eq('status_serie', status_serie);
        if (tmdb_hit !== undefined) query = query.eq('tmdb_hit', tmdb_hit);
        
        // Busca textual expandida
        if (search) {
            query = query.or(`nome.ilike.%${search}%,nome_episodio.ilike.%${search}%,descricao_serie.ilike.%${search}%,descricao_episodio.ilike.%${search}%`);
        }
        
        // Filtro por nome da série
        if (serie_nome) {
            query = query.ilike('nome', `%${serie_nome}%`);
        }

        // Ordenação
        const validSortFields = ['nome', 'rating', 'total_visualizations', 'created_at', 'temporada', 'episodio'];
        const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
        query = query.order(sortField, { ascending: sort_order === 'asc' });

        // Se ordenando por temporada/episódio, adicionar ordenação secundária
        if (sort_by === 'temporada') {
            query = query.order('episodio', { ascending: sort_order === 'asc' });
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
     * Buscar episódios de uma série (expandido)
     */
    static async findEpisodesBySeries(seriesName, season = null) {
        let query = supabaseAdmin
            .from('contents')
            .select('*')
            .eq('nome', seriesName)
            .in('subcategoria', ['serie', 'anime', 'minisserie'])
            .order('temporada', { ascending: true })
            .order('episodio', { ascending: true });

        if (season) {
            query = query.eq('temporada', season);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar todas as séries (sem episódios duplicados)
     */
    static async findAllSeries() {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('nome, descricao_serie, status_serie, temporadas_total, episodios_total, poster, backdrop, categoria, tmdb_serie_id, tmdb_hit')
            .in('subcategoria', ['serie', 'anime', 'minisserie'])
            .eq('ativo', true)
            .order('nome');

        if (error) {
            throw error;
        }

        // Remover duplicatas por nome da série
        const uniqueSeries = [];
        const seenNames = new Set();

        data.forEach(serie => {
            if (!seenNames.has(serie.nome)) {
                seenNames.add(serie.nome);
                uniqueSeries.push(serie);
            }
        });

        return uniqueSeries;
    }

    /**
     * Buscar temporadas de uma série específica
     */
    static async findSeasonsBySeries(seriesName) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('temporada, descricao_temporada, COUNT(*) as episodios_count')
            .eq('nome', seriesName)
            .in('subcategoria', ['serie', 'anime', 'minisserie'])
            .eq('ativo', true)
            .not('temporada', 'is', null)
            .group('temporada, descricao_temporada')
            .order('temporada');

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar próximo episódio de uma série
     */
    static async findNextEpisode(seriesName, currentSeason, currentEpisode) {
        // Primeiro tentar próximo episódio da mesma temporada
        let { data, error } = await supabaseAdmin
            .from('contents')
            .select('*')
            .eq('nome', seriesName)
            .eq('temporada', currentSeason)
            .gt('episodio', currentEpisode)
            .eq('ativo', true)
            .order('episodio', { ascending: true })
            .limit(1);

        if (error) {
            throw error;
        }

        // Se não encontrou, buscar primeiro episódio da próxima temporada
        if (!data.length) {
            const nextSeasonResult = await supabaseAdmin
                .from('contents')
                .select('*')
                .eq('nome', seriesName)
                .gt('temporada', currentSeason)
                .eq('ativo', true)
                .order('temporada', { ascending: true })
                .order('episodio', { ascending: true })
                .limit(1);

            data = nextSeasonResult.data;
        }

        return data[0] || null;
    }

    /**
     * Buscar episódio anterior de uma série
     */
    static async findPreviousEpisode(seriesName, currentSeason, currentEpisode) {
        // Primeiro tentar episódio anterior da mesma temporada
        let { data, error } = await supabaseAdmin
            .from('contents')
            .select('*')
            .eq('nome', seriesName)
            .eq('temporada', currentSeason)
            .lt('episodio', currentEpisode)
            .eq('ativo', true)
            .order('episodio', { ascending: false })
            .limit(1);

        if (error) {
            throw error;
        }

        // Se não encontrou, buscar último episódio da temporada anterior
        if (!data.length) {
            const prevSeasonResult = await supabaseAdmin
                .from('contents')
                .select('*')
                .eq('nome', seriesName)
                .lt('temporada', currentSeason)
                .eq('ativo', true)
                .order('temporada', { ascending: false })
                .order('episodio', { ascending: false })
                .limit(1);

            data = prevSeasonResult.data;
        }

        return data[0] || null;
    }

    /**
     * Buscar conteúdos por TMDB ID
     */
    static async findByTmdbId(tmdbSerieId, tmdbTemporadaId = null, tmdbEpisodioId = null) {
        let query = supabaseAdmin
            .from('contents')
            .select('*')
            .eq('tmdb_serie_id', tmdbSerieId)
            .eq('tmdb_hit', true);

        if (tmdbTemporadaId) {
            query = query.eq('tmdb_temporada_id', tmdbTemporadaId);
        }

        if (tmdbEpisodioId) {
            query = query.eq('tmdb_episodio_id', tmdbEpisodioId);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Verificar se episódio já existe
     */
    static async episodeExists(seriesName, season, episode) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('id')
            .eq('nome', seriesName)
            .eq('temporada', season)
            .eq('episodio', episode)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    }

    /**
     * Obter estatísticas de conteúdo expandidas
     */
    static async getStats() {
        try {
            // Estatísticas por categoria
            const { data: contents, error: contentsError } = await supabaseAdmin
                .from('contents')
                .select('categoria, subcategoria, total_visualizations, tmdb_hit, status_serie')
                .eq('ativo', true);

            if (contentsError) {
                throw contentsError;
            }

            // Agrupar estatísticas
            const categoryStats = {};
            const subcategoryStats = {};
            const seriesStatusStats = {};
            let totalViews = 0;
            let tmdbHits = 0;

            contents.forEach(content => {
                // Contar por categoria
                categoryStats[content.categoria] = (categoryStats[content.categoria] || 0) + 1;
                
                // Contar por subcategoria
                subcategoryStats[content.subcategoria] = (subcategoryStats[content.subcategoria] || 0) + 1;
                
                // Contar status de séries
                if (content.status_serie) {
                    seriesStatusStats[content.status_serie] = (seriesStatusStats[content.status_serie] || 0) + 1;
                }
                
                // Somar visualizações
                totalViews += content.total_visualizations || 0;
                
                // Contar TMDB hits
                if (content.tmdb_hit) {
                    tmdbHits++;
                }
            });

            // Buscar estatísticas de séries
            const { data: seriesData, error: seriesError } = await supabaseAdmin
                .from('contents')
                .select('nome')
                .in('subcategoria', ['serie', 'anime', 'minisserie'])
                .eq('ativo', true);

            if (seriesError) {
                throw seriesError;
            }

            const uniqueSeries = new Set(seriesData.map(s => s.nome)).size;

            return {
                totalContents: contents.length,
                totalViews,
                tmdbHits,
                tmdbHitRate: Math.round((tmdbHits / contents.length) * 100),
                uniqueSeries,
                categoryStats: Object.entries(categoryStats).map(([categoria, count]) => ({
                    categoria,
                    count
                })),
                subcategoryStats: Object.entries(subcategoryStats).map(([subcategoria, count]) => ({
                    subcategoria,
                    count
                })),
                seriesStatusStats: Object.entries(seriesStatusStats).map(([status, count]) => ({
                    status,
                    count
                }))
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Buscar conteúdos relacionados
     */
    static async findRelated(contentId, limit = 5) {
        // Primeiro buscar o conteúdo original
        const originalContent = await this.findById(contentId);
        if (!originalContent) {
            return [];
        }

        let query = supabaseAdmin
            .from('contents')
            .select('*')
            .eq('ativo', true)
            .neq('id', contentId);

        // Se for série, buscar outros episódios da mesma série
        if (['serie', 'anime', 'minisserie'].includes(originalContent.subcategoria)) {
            query = query.eq('nome', originalContent.nome);
        } else {
            // Para filmes, buscar por categoria similar
            query = query.eq('categoria', originalContent.categoria);
        }

        query = query
            .order('total_visualizations', { ascending: false })
            .limit(limit);

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Atualizar contador de visualizações
     */
    static async incrementViewCount(contentId) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .update({ 
                total_visualizations: supabaseAdmin.raw('total_visualizations + 1')
            })
            .eq('id', contentId)
            .select('total_visualizations')
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar conteúdos por faixa de rating
     */
    static async findByRatingRange(minRating, maxRating, limit = 20) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('*')
            .eq('ativo', true)
            .gte('rating', minRating)
            .lte('rating', maxRating)
            .order('rating', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar conteúdos recém-adicionados
     */
    static async findRecent(limit = 10) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('*')
            .eq('ativo', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        return data;
    }
}

module.exports = ContentModel;