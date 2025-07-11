const express = require('express');
const AuthController = require('../controllers/auth-controller');
const { validateData } = require('../middlewares/validation-middleware');
const { autoLog, logRateLimit } = require('../middlewares/logging-middleware');
const { registerValidation, loginValidation, emailValidation } = require('../validations/auth-validations');
const { ACTION_TYPES } = require('../utils/action-types');

const router = express.Router();

// Aplicar rate limiting em todas as rotas de autenticação
router.use(logRateLimit);

// Rota para registro de usuário
router.post('/register', 
    validateData(registerValidation),
    AuthController.register
);

// Rota para login
router.post('/login', 
    validateData(loginValidation),
    AuthController.login
);

// Rota para verificar se email existe
router.post('/check-email', 
    validateData(emailValidation),
    AuthController.checkEmail
);

module.exports = router;