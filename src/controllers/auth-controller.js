const AuthService = require('../services/auth-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');

class AuthController {
    /**
     * Registrar novo usuário
     */
    static async register(req, res, next) {
        try {
            const result = await AuthService.register(req.body);
            
            // Log da ação de registro
            await LoggingService.logUserAction({
                userId: result.user.id,
                actionType: ACTION_TYPES.USER_REGISTER,
                description: 'New user registered successfully',
                metadata: {
                    email: result.user.email,
                    nome: result.user.nome,
                    profilesCreated: result.profiles.length
                },
                request: req,
                statusCode: 201
            });
            
            res.status(201).json({
                success: true,
                message: 'Usuário registrado com sucesso',
                data: result
            });
        } catch (error) {
            // Log da falha no registro
            await LoggingService.logUserAction({
                actionType: ACTION_TYPES.USER_REGISTER,
                description: 'User registration failed',
                metadata: {
                    email: req.body.email,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
            next(error);
        }
    }

    /**
     * Login do usuário
     */
    static async login(req, res, next) {
        try {
            const { email, senha } = req.body;
            const result = await AuthService.login(email, senha);
            
            // Log da ação de login
            await LoggingService.logUserAction({
                userId: result.user.id,
                actionType: ACTION_TYPES.USER_LOGIN,
                description: 'User logged in successfully',
                metadata: {
                    email: result.user.email,
                    profilesCount: result.profiles.length
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Login realizado com sucesso',
                data: result
            });
        } catch (error) {
            // Log da falha no login
            await LoggingService.logUserAction({
                actionType: ACTION_TYPES.USER_LOGIN,
                description: 'User login failed',
                metadata: {
                    email: req.body.email,
                    error: error.message
                },
                request: req,
                statusCode: 401
            });
            
            // Tratar erro de credenciais inválidas
            if (error.message.includes('Email ou senha inválidos')) {
                return res.status(401).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Verificar se email existe
     */
    static async checkEmail(req, res, next) {
        try {
            const { email } = req.body;
            const result = await AuthService.checkEmail(email);
            
            // Log da verificação de email
            await LoggingService.logUserAction({
                actionType: ACTION_TYPES.EMAIL_CHECK,
                description: 'Email existence check',
                metadata: {
                    email,
                    exists: result.exists
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Verificação de email realizada',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = AuthController;