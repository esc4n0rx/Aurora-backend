const express = require('express');
const AuthController = require('../controllers/auth-controller');
const { validateData } = require('../middlewares/validation-middleware');
const { registerValidation, loginValidation, emailValidation } = require('../validations/auth-validations');

const router = express.Router();

// Rota para registro de usuário
router.post('/register', validateData(registerValidation), AuthController.register);

// Rota para login
router.post('/login', validateData(loginValidation), AuthController.login);

// Rota para verificar se email existe
router.post('/check-email', validateData(emailValidation), AuthController.checkEmail);

module.exports = router;