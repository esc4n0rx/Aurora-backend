const express = require('express');
const ProxyController = require('../controllers/proxy-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { requireAdmin } = require('../middlewares/admin-middleware');
const { validateData } = require('../middlewares/validation-middleware');
const {
    validateProxyRequest,
    proxyRateLimit,
    proxySecurityHeaders,
    logProxyAccess,
    handleProxyOptions,
    proxyTimeout,
    validateProxyId
} = require('../middlewares/proxy-middleware');
const {
    createProxyValidation,
    testUrlValidation,
    clearCacheValidation
} = require('../validations/proxy-validations');

const router = express.Router();

// Middleware global para todas as rotas de proxy
router.use(proxySecurityHeaders);
router.use(handleProxyOptions);
router.use(validateProxyRequest);

// === ROTAS PÚBLICAS DE STREAMING ===

// Stream através do proxy (público com rate limiting)
router.get('/stream/:proxyId', 
    proxyRateLimit,
    validateProxyId,
    proxyTimeout,
    logProxyAccess,
    ProxyController.streamProxy
);

// Stream de URL codificada (para segmentos de playlist)
router.get('/segment/:encodedUrl',
    proxyRateLimit,
    proxyTimeout,
    logProxyAccess,
    ProxyController.streamEncodedUrl
);

// === ROTAS AUTENTICADAS ===

// Middleware de autenticação para rotas protegidas
router.use(authenticateToken);

// Criar proxy para conteúdo
router.post('/content/:contentId', 
    validateData(createProxyValidation),
    ProxyController.createContentProxy
);

// Obter informações do proxy
router.get('/info/:proxyId',
    validateProxyId,
    ProxyController.getProxyInfo
);

// === ROTAS ADMINISTRATIVAS ===

// Middleware de admin para rotas administrativas
router.use(requireAdmin);

// Obter estatísticas do proxy
router.get('/admin/stats', 
    ProxyController.getProxyStats
);

// Limpar cache do proxy
router.delete('/admin/cache',
    validateData(clearCacheValidation),
    ProxyController.clearProxyCache
);

// Testar URL de streaming
router.post('/admin/test-url',
    validateData(testUrlValidation),
    ProxyController.testStreamingUrl
);

module.exports = router;