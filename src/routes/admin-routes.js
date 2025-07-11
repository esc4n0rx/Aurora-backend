const express = require('express');
const AdminController = require('../controllers/admin-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { requireAdmin } = require('../middlewares/admin-middleware');
const { validateData } = require('../middlewares/validation-middleware');
const { 
    listUsersValidation, 
    blockUserValidation,
    logsFiltersValidation,
    logsStatsValidation
} = require('../validations/admin-validations');

const router = express.Router();

// Middleware: todas as rotas requerem autenticação e permissão de admin
router.use(authenticateToken);
router.use(requireAdmin);

// === ROTAS DE GERENCIAMENTO DE USUÁRIOS ===

// Listar usuários
router.get('/users', 
    validateData(listUsersValidation), 
    AdminController.listUsers
);

// Obter detalhes de um usuário
router.get('/users/:userId', AdminController.getUserDetails);

// Bloquear usuário
router.post('/users/:userId/block', 
    validateData(blockUserValidation), 
    AdminController.blockUser
);

// Desbloquear usuário
router.post('/users/:userId/unblock', AdminController.unblockUser);

// Remover usuário (soft delete)
router.delete('/users/:userId', AdminController.deleteUser);

// Restaurar usuário removido
router.post('/users/:userId/restore', AdminController.restoreUser);

// === ROTAS DE LOGS DO SISTEMA ===

// Listar logs
router.get('/logs', 
    validateData(logsFiltersValidation), 
    AdminController.getLogs
);

// Estatísticas de logs
router.get('/logs/stats', 
    validateData(logsStatsValidation), 
    AdminController.getLogsStats
);

// === ROTAS DE ESTATÍSTICAS GERAIS ===

// Estatísticas gerais do sistema
router.get('/stats', AdminController.getSystemStats);

module.exports = router;