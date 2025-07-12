const express = require('express');
const StreamController = require('../controllers/stream-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { requireAdmin } = require('../middlewares/admin-middleware');
const { 
    validateStreamRequest, 
    logStreamAccess, 
    streamRateLimit, 
    streamSecurityHeaders 
} = require('../middlewares/stream-middleware');

const router = express.Router();

// Middleware global para todas as rotas de stream
router.use(streamSecurityHeaders);
router.use(logStreamAccess);

// === ROTAS PÚBLICAS (com rate limiting) ===

// Stream direto de vídeo por streamId
router.get('/:streamId/video', 
    streamRateLimit,
    validateStreamRequest,
    StreamController.streamVideo
);

// === ROTAS AUTENTICADAS ===

// Middleware de autenticação para rotas protegidas
router.use(authenticateToken);

// Iniciar stream de conteúdo
router.post('/content/:contentId/start', 
    StreamController.startStream
);

// Stream direto de conteúdo (compatibilidade)
router.get('/content/:contentId/play', 
    streamRateLimit,
    validateStreamRequest,
    StreamController.streamContent
);

// Obter informações de um stream
router.get('/:streamId/info', 
    StreamController.getStreamInfo
);

// Parar stream
router.delete('/:streamId', 
    StreamController.stopStream
);

// === ROTAS ADMINISTRATIVAS ===

// Middleware de admin para rotas administrativas
router.use(requireAdmin);

// Obter estatísticas de streaming
router.get('/admin/stats', 
    StreamController.getStreamStats
);

module.exports = router;