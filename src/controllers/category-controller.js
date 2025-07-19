const CategoryService = require('../services/category-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');

class CategoryController {
    /**
     * Listar todas as categorias
     */
    static async getAllCategories(req, res, next) {
        try {
            const result = await CategoryService.getAllCategories();
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CATEGORIES_LIST,
                description: 'All categories listed',
                metadata: {
                    totalCategories: result.total_categories
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Categorias obtidas com sucesso',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Obter categorias populares
     */
    static async getPopularCategories(req, res, next) {
        try {
            const { limit = 20 } = req.query;
            const categories = await CategoryService.getPopularCategories(parseInt(limit));
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CATEGORIES_POPULAR,
                description: 'Popular categories accessed',
                metadata: {
                    limit: parseInt(limit),
                    categoriesCount: categories.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Categorias populares obtidas com sucesso',
                data: categories
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Buscar categorias
     */
    static async searchCategories(req, res, next) {
        try {
            const { q: searchTerm, limit = 10 } = req.query;
            
            if (!searchTerm) {
                return res.status(400).json({
                    success: false,
                    message: 'Parâmetro de busca "q" é obrigatório'
                });
            }

            const categories = await CategoryService.searchCategories(searchTerm, parseInt(limit));
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CATEGORIES_SEARCH,
                description: 'Categories searched',
                metadata: {
                    searchTerm,
                    limit: parseInt(limit),
                    resultsCount: categories.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Busca de categorias realizada com sucesso',
                data: {
                    search_term: searchTerm,
                    results_count: categories.length,
                    categories
                }
            });
        } catch (error) {
            if (error.message.includes('pelo menos 2 caracteres')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Obter detalhes de categoria específica
     */
    static async getCategoryDetails(req, res, next) {
        try {
            const { categoria } = req.params;
            const details = await CategoryService.getCategoryDetails(categoria);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CATEGORY_DETAILS,
                description: 'Category details accessed',
                metadata: {
                    categoria,
                    totalContents: details.total_contents,
                    totalViews: details.total_views
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Detalhes da categoria obtidos com sucesso',
                data: details
            });
        } catch (error) {
            if (error.message.includes('não encontrada')) {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Obter categorias agrupadas por streaming
     */
    static async getStreamingCategories(req, res, next) {
        try {
            const result = await CategoryService.getStreamingCategories();
            
            // Log da ação
            await LoggingService.logUserAction({
                userId: req.user?.userId || null,
                actionType: ACTION_TYPES.CATEGORIES_STREAMING,
                description: 'Streaming categories accessed',
                metadata: {
                    totalStreaming: result.total_streaming,
                    totalOthers: result.total_others
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Categorias de streaming obtidas com sucesso',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = CategoryController;