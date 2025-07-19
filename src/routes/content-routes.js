const express = require('express');
const ContentController = require('../controllers/content-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { requireAdmin } = require('../middlewares/admin-middleware');
const { validateData } = require('../middlewares/validation-middleware');
const { 
    createContentValidation, 
    updateContentValidation,
    listContentValidation,
    recordViewValidation,
    testConnectivityValidation,
    recommendationsValidation
} = require('../validations/content-validations');

const router = express.Router();

// Rotas públicas (sem autenticação)
// Listar conteúdos populares
router.get('/popular', ContentController.getPopularContents);

// Obter episódios de uma série
router.get('/series/:seriesName/episodes', ContentController.getSeriesEpisodes);

// Registrar visualização de conteúdo (atualizada)
router.post('/:contentId/view', 
    validateData(recordViewValidation), 
    ContentController.recordView
);

// Middleware de autenticação para rotas protegidas
router.use(authenticateToken);

// Rotas que requerem apenas autenticação (usuários normais)
// Listar conteúdos (com filtros básicos)
router.get('/', 
    validateData(listContentValidation), 
    ContentController.listContents
);

// Obter conteúdo por ID
router.get('/:contentId', ContentController.getContentById);

// Obter status de streaming do conteúdo
router.get('/:contentId/streaming-status', ContentController.getStreamingStatus);

// Obter recomendações personalizadas
router.get('/user/recommendations',
    validateData(recommendationsValidation),
    ContentController.getRecommendations
);

// Middleware de admin para rotas administrativas
router.use(requireAdmin);

// Rotas administrativas (apenas admin)
// Criar novo conteúdo
router.post('/', 
    validateData(createContentValidation), 
    ContentController.createContent
);

// Atualizar conteúdo
router.put('/:contentId', 
    validateData(updateContentValidation), 
    ContentController.updateContent
);

// Excluir conteúdo
router.delete('/:contentId', ContentController.deleteContent);

// Obter estatísticas gerais
router.get('/admin/stats', ContentController.getContentStats);

// Obter estatísticas de visualização de um conteúdo
router.get('/:contentId/stats', ContentController.getContentViewStats);

// Testar conectividade de um conteúdo
router.post('/:contentId/test-connectivity',
    validateData(testConnectivityValidation),
    ContentController.testContentConnectivity
);

module.exports = router;