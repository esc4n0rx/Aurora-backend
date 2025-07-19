const express = require('express');
const CategoryController = require('../controllers/category-controller');
const { validateData } = require('../middlewares/validation-middleware');
const { 
    categoriesListValidation,
    categorySearchValidation,
    categoryDetailsValidation
} = require('../validations/category-validations');

const router = express.Router();

// Rotas públicas para categorias

// Listar todas as categorias
router.get('/', CategoryController.getAllCategories);

// Obter categorias populares
router.get('/popular', 
    validateData(categoriesListValidation),
    CategoryController.getPopularCategories
);

// Buscar categorias
router.get('/search', 
    validateData(categorySearchValidation),
    CategoryController.searchCategories
);

// Obter categorias agrupadas por streaming
router.get('/streaming', CategoryController.getStreamingCategories);

// Obter detalhes de categoria específica
router.get('/:categoria', 
    validateData(categoryDetailsValidation),
    CategoryController.getCategoryDetails
);

module.exports = router;