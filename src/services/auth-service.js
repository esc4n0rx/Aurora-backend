const UserModel = require('../models/user-model');
const ProfileService = require('./profile-service');
const { hashPassword, comparePassword } = require('../utils/password-utils');
const { generateToken } = require('../config/jwt');

class AuthService {
    /**
     * Registrar novo usuário
     */
    static async register(userData) {
        const { nome, email, senha, data_nascimento } = userData;

        // Verificar se o email já existe
        const emailExists = await UserModel.emailExists(email);
        if (emailExists) {
            throw new Error('Este email já está cadastrado');
        }

        // Criptografar a senha
        const hashedPassword = await hashPassword(senha);

        // Criar o usuário
        const user = await UserModel.create({
            nome,
            email,
            senha: hashedPassword,
            data_nascimento
        });

        // Criar perfis padrão
        const profiles = await ProfileService.createDefaultProfiles(user.id, nome);

        // Gerar token JWT
        const token = generateToken({
            userId: user.id,
            email: user.email,
            nome: user.nome
        });

        // Retornar dados sem a senha
        const { senha: _, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            profiles,
            token
        };
    }

    /**
     * Login do usuário
     */
    static async login(email, senha) {
        // Buscar usuário por email
        const user = await UserModel.findByEmail(email);
        if (!user) {
            throw new Error('Email ou senha inválidos');
        }

        // Verificar senha
        const isPasswordValid = await comparePassword(senha, user.senha);
        if (!isPasswordValid) {
            throw new Error('Email ou senha inválidos');
        }

        // Buscar perfis do usuário
        const profiles = await ProfileService.getProfilesByUserId(user.id);

        // Gerar token JWT
        const token = generateToken({
            userId: user.id,
            email: user.email,
            nome: user.nome
        });

        // Retornar dados sem a senha
        const { senha: _, ...userWithoutPassword } = user;

        return {
            user: userWithoutPassword,
            profiles,
            token
        };
    }

    /**
     * Verificar se um email já está cadastrado
     */
    static async checkEmail(email) {
        const exists = await UserModel.emailExists(email);
        return { exists };
    }
}

module.exports = AuthService;