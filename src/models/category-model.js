const { supabaseAdmin } = require('../config/database');

class CategoryModel {
    /**
     * Obter todas as categorias disponíveis com contagem
     */
    static async findAllWithCount() {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('categoria')
            .eq('ativo', true);

        if (error) {
            throw error;
        }

        // Agrupar e contar categorias
        const categoryCount = {};
        data.forEach(content => {
            if (content.categoria) {
                categoryCount[content.categoria] = (categoryCount[content.categoria] || 0) + 1;
            }
        });

        // Converter para array e ordenar por contagem
        const categories = Object.entries(categoryCount)
            .map(([categoria, count]) => ({
                categoria,
                total: count
            }))
            .sort((a, b) => b.total - a.total);

        return categories;
    }

    /**
     * Obter categorias mais populares
     */
    static async findPopular(limit = 20) {
        const allCategories = await this.findAllWithCount();
        return allCategories.slice(0, limit);
    }

    /**
     * Buscar categorias por termo
     */
    static async searchCategories(searchTerm, limit = 10) {
        const allCategories = await this.findAllWithCount();
        
        const filtered = allCategories.filter(cat => 
            cat.categoria.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return filtered.slice(0, limit);
    }

    /**
     * Verificar se categoria existe
     */
    static async exists(categoria) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('id')
            .eq('categoria', categoria)
            .eq('ativo', true)
            .limit(1);

        if (error) {
            throw error;
        }

        return data.length > 0;
    }

    /**
     * Obter estatísticas de categoria específica
     */
    static async getCategoryStats(categoria) {
        const { data, error } = await supabaseAdmin
            .from('contents')
            .select('subcategoria, total_visualizations, rating, created_at')
            .eq('categoria', categoria)
            .eq('ativo', true);

        if (error) {
            throw error;
        }

        if (!data.length) {
            return null;
        }

        // Calcular estatísticas
        const subcategorias = {};
        let totalViews = 0;
        let totalRating = 0;
        let validRatings = 0;

        data.forEach(content => {
            // Subcategorias
            if (content.subcategoria) {
                subcategorias[content.subcategoria] = (subcategorias[content.subcategoria] || 0) + 1;
            }

            // Visualizações
            totalViews += content.total_visualizations || 0;

            // Rating médio
            if (content.rating && content.rating > 0) {
                totalRating += content.rating;
                validRatings++;
            }
        });

        const averageRating = validRatings > 0 ? Math.round((totalRating / validRatings) * 10) / 10 : 0;

        return {
            categoria,
            total_contents: data.length,
            total_views: totalViews,
            average_rating: averageRating,
            subcategorias: Object.entries(subcategorias).map(([subcategoria, count]) => ({
                subcategoria,
                count
            })).sort((a, b) => b.count - a.count),
            created_range: {
                oldest: data.reduce((oldest, content) => 
                    content.created_at < oldest ? content.created_at : oldest, 
                    data[0].created_at
                ),
                newest: data.reduce((newest, content) => 
                    content.created_at > newest ? content.created_at : newest, 
                    data[0].created_at
                )
            }
        };
    }
}

module.exports = CategoryModel;