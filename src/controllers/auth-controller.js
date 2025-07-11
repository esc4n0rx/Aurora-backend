const AuthService = require('../services/auth-service');

class AuthController {
    /**
     * Registrar novo usuário
     */
    static async register(req, res, next) {
        try {
            const result = await AuthService.register(req.body);
            
            res.status(201).json({
                success: true,
                message: 'Usuário registrado com sucesso',
                data: result
            });
        } catch (error) {
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
            
            res.json({
                success: true,
                message: 'Login realizado com sucesso',
                data: result
            });
        } catch (error) {
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