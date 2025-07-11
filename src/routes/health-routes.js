const express = require('express');
const HealthController = require('../controllers/health-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');

const router = express.Router();

// Rotas públicas para monitoring/load balancers
router.get('/', HealthController.basicHealth);
router.get('/ready', HealthController.readiness);
router.get('/live', HealthController.liveness);

// Rota protegida para health detalhado
router.get('/full', authenticateToken, HealthController.fullHealth);

module.exports = router;