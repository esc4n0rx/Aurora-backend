const ProfileService = require('../services/profile-service');

class ProfileController {
    /**
     * Listar perfis do usuário
     */
    static async getProfiles(req, res, next) {
        try {
            const userId = req.user.userId;
            const profiles = await ProfileService.getProfilesByUserId(userId);
            
            res.json({
                success: true,
                message: 'Perfis obtidos com sucesso',
                data: profiles
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Criar novo perfil
     */
    static async createProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const profile = await ProfileService.createProfile(userId, req.body);
            
            res.status(201).json({
                success: true,
                message: 'Perfil criado com sucesso',
                data: profile
            });
        } catch (error) {
            if (error.message.includes('Limite máximo') || 
                error.message.includes('inválido')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Atualizar perfil
     */
    static async updateProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const { profileId } = req.params;
            
            const profile = await ProfileService.updateProfile(userId, profileId, req.body);
            
            res.json({
                success: true,
                message: 'Perfil atualizado com sucesso',
                data: profile
            });
        } catch (error) {
            if (error.message.includes('não encontrado') || 
                error.message.includes('não pertence') ||
                error.message.includes('inválido')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Excluir perfil
     */
    static async deleteProfile(req, res, next) {
        try {
            const userId = req.user.userId;
            const { profileId } = req.params;
            
            const result = await ProfileService.deleteProfile(userId, profileId);
            
            res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message.includes('não encontrado') || 
                error.message.includes('não pertence') ||
                error.message.includes('último perfil')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Atualizar avatar do perfil
     */
    static async updateAvatar(req, res, next) {
        try {
            const userId = req.user.userId;
            const { profileId } = req.params;
            const { avatar_id } = req.body;
            
            if (!avatar_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID do avatar é obrigatório'
                });
            }

            const profile = await ProfileService.updateAvatar(userId, profileId, avatar_id);
            
            res.json({
                success: true,
                message: 'Avatar atualizado com sucesso',
                data: profile
            });
        } catch (error) {
            if (error.message.includes('não encontrado') || 
                error.message.includes('não pertence') ||
                error.message.includes('inválido')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Listar avatares disponíveis
     */
    static async getAvailableAvatars(req, res, next) {
        try {
            const { category } = req.query;
            const avatars = await ProfileService.getAvailableAvatars(category);
            
            res.json({
                success: true,
                message: 'Avatares disponíveis obtidos com sucesso',
                data: avatars
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Autenticar perfil
     */
    static async authenticateProfile(req, res, next) {
        try {
            const { profileId, senha } = req.body;
            const profile = await ProfileService.authenticateProfile(profileId, senha);
            
            res.json({
                success: true,
                message: 'Perfil autenticado com sucesso',
                data: profile
            });
        } catch (error) {
            if (error.message.includes('não encontrado') || error.message.includes('Senha incorreta')) {
                return res.status(401).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }

    /**
     * Obter perfil por ID
     */
    static async getProfileById(req, res, next) {
        try {
            const { profileId } = req.params;
            const profile = await ProfileService.getProfileById(profileId);
            
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Perfil não encontrado'
                });
            }

            // Remover senha da resposta
            const { senha: _, ...profileWithoutPassword } = profile;
            
            res.json({
                success: true,
                message: 'Perfil obtido com sucesso',
                data: profileWithoutPassword
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ProfileController;