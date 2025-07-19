const CategoryModel = require('../models/category-model');
const { logger } = require('../config/logger');

class CategoryService {
    /**
     * Listar todas as categorias com contagem
     */
    static async getAllCategories() {
        try {
            const categories = await CategoryModel.findAllWithCount();
            
            return {
                total_categories: categories.length,
                categories: categories.map(cat => ({
                    ...cat,
                    slug: this.generateSlug(cat.categoria),
                    display_name: this.formatDisplayName(cat.categoria)
                }))
            };
        } catch (error) {
            logger.error('Failed to get all categories', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Obter categorias populares
     */
    static async getPopularCategories(limit = 20) {
        try {
            const categories = await CategoryModel.findPopular(limit);
            
            return categories.map(cat => ({
                ...cat,
                slug: this.generateSlug(cat.categoria),
                display_name: this.formatDisplayName(cat.categoria)
            }));
        } catch (error) {
            logger.error('Failed to get popular categories', {
                error: error.message,
                limit
            });
            throw error;
        }
    }

    /**
     * Buscar categorias por termo
     */
    static async searchCategories(searchTerm, limit = 10) {
        try {
            if (!searchTerm || searchTerm.trim().length < 2) {
                throw new Error('Termo de busca deve ter pelo menos 2 caracteres');
            }

            const categories = await CategoryModel.searchCategories(searchTerm.trim(), limit);
            
            return categories.map(cat => ({
                ...cat,
                slug: this.generateSlug(cat.categoria),
                display_name: this.formatDisplayName(cat.categoria),
                relevance: this.calculateRelevance(cat.categoria, searchTerm)
            })).sort((a, b) => b.relevance - a.relevance);
        } catch (error) {
            logger.error('Failed to search categories', {
                error: error.message,
                searchTerm,
                limit
            });
            throw error;
        }
    }

    /**
     * Obter detalhes de categoria específica
     */
    static async getCategoryDetails(categoria) {
        try {
            // Verificar se categoria existe
            const exists = await CategoryModel.exists(categoria);
            if (!exists) {
                throw new Error('Categoria não encontrada');
            }

            const stats = await CategoryModel.getCategoryStats(categoria);
            
            return {
                ...stats,
                slug: this.generateSlug(categoria),
                display_name: this.formatDisplayName(categoria)
            };
        } catch (error) {
            logger.error('Failed to get category details', {
                error: error.message,
                categoria
            });
            throw error;
        }
    }

    /**
     * Gerar slug para categoria
     */
    static generateSlug(categoria) {
        return categoria
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
            .replace(/\s+/g, '-') // Substitui espaços por hífens
            .replace(/-+/g, '-') // Remove hífens duplos
            .trim('-'); // Remove hífens das extremidades
    }

    /**
     * Formatar nome para exibição
     */
    static formatDisplayName(categoria) {
        // Casos especiais de formatação
        const specialCases = {
            'NETFLIX': 'Netflix',
            'AMAZON PRIME VIDEO': 'Amazon Prime Video',
            'DISNEY PLUS': 'Disney+',
            'HBO MAX': 'HBO Max',
            'APPLE TV PLUS': 'Apple TV+',
            'PARAMOUNT PLUS': 'Paramount+',
            'DISCOVERY PLUS': 'Discovery+',
            'STAR PLUS': 'Star+',
            'STARZ PLAY': 'Starz Play',
            'DIRECTV': 'DirecTV',
            'GLOBOPLAY': 'Globoplay',
            'BRASIL PARALELO': 'Brasil Paralelo',
            'MARVEL': 'Marvel',
            'DC COMICS': 'DC Comics'
        };

        if (specialCases[categoria]) {
            return specialCases[categoria];
        }

        // Formatação padrão: primeira letra maiúscula de cada palavra
        return categoria
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Calcular relevância da busca
     */
    static calculateRelevance(categoria, searchTerm) {
        const lowerCategoria = categoria.toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();
        
        // Correspondência exata
        if (lowerCategoria === lowerSearch) return 100;
        
        // Começa com o termo
        if (lowerCategoria.startsWith(lowerSearch)) return 80;
        
        // Contém o termo
        if (lowerCategoria.includes(lowerSearch)) return 60;
        
        // Palavras em comum
        const categoriaWords = lowerCategoria.split(' ');
        const searchWords = lowerSearch.split(' ');
        const commonWords = categoriaWords.filter(word => 
            searchWords.some(searchWord => word.includes(searchWord))
        );
        
        return (commonWords.length / categoriaWords.length) * 40;
    }

    /**
     * Obter categorias por tipo de streaming
     */
    static async getStreamingCategories() {
        try {
            const allCategories = await this.getAllCategories();
            
            const streamingPlatforms = [
                'NETFLIX', 'AMAZON PRIME VIDEO', 'DISNEY PLUS', 'HBO MAX',
                'PARAMOUNT PLUS', 'APPLE TV PLUS', 'DISCOVERY PLUS', 'STAR PLUS',
                'GLOBOPLAY', 'STARZ PLAY', 'DIRECTV'
            ];

            const streamingCats = allCategories.categories.filter(cat =>
                streamingPlatforms.includes(cat.categoria)
            );

            const otherCats = allCategories.categories.filter(cat =>
                !streamingPlatforms.includes(cat.categoria)
            );

            return {
                streaming_platforms: streamingCats,
                other_categories: otherCats,
                total_streaming: streamingCats.length,
                total_others: otherCats.length
            };
        } catch (error) {
            logger.error('Failed to get streaming categories', {
                error: error.message
            });
            throw error;
        }
    }
}

module.exports = CategoryService;