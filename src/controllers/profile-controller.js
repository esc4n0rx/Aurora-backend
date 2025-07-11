const ProfileService = require('../services/profile-service');
const LoggingService = require('../services/logging-service');
const { ACTION_TYPES } = require('../utils/action-types');

class ProfileController {
    /**
     * Listar perfis do usuário
     */
    static async getProfiles(req, res, next) {
        try {
            const userId = req.user.userId;
            const profiles = await ProfileService.getProfilesByUserId(userId);
            
            // Log da ação
            await LoggingService.logUserAction({
                userId,
                actionType: ACTION_TYPES.PROFILE_ACCESS,
                description: 'User profiles listed',
                metadata: {
                    profilesCount: profiles.length
                },
                request: req,
                statusCode: 200
            });
            
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
            
            // Log da criação de perfil
            await LoggingService.logUserAction({
                userId,
                profileId: profile.id,
                actionType: ACTION_TYPES.PROFILE_CREATE,
                description: 'New profile created',
                metadata: {
                    profileName: profile.nome,
                    profileType: profile.tipo,
                    hasPassword: !!req.body.senha,
                    avatarId: profile.avatar_id
                },
                request: req,
                statusCode: 201
            });
            
            res.status(201).json({
                success: true,
                message: 'Perfil criado com sucesso',
                data: profile
            });
        } catch (error) {
            // Log da falha na criação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                actionType: ACTION_TYPES.PROFILE_CREATE,
                description: 'Profile creation failed',
                metadata: {
                    profileName: req.body.nome,
                    profileType: req.body.tipo,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
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
            
            // Log da atualização
            await LoggingService.logUserAction({
                userId,
                profileId,
                actionType: ACTION_TYPES.PROFILE_UPDATE,
                description: 'Profile updated',
                metadata: {
                    updatedFields: Object.keys(req.body),
                    profileName: profile.nome
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Perfil atualizado com sucesso',
                data: profile
            });
        } catch (error) {
            // Log da falha na atualização
            await LoggingService.logUserAction({
                userId: req.user.userId,
                profileId: req.params.profileId,
                actionType: ACTION_TYPES.PROFILE_UPDATE,
                description: 'Profile update failed',
                metadata: {
                    updatedFields: Object.keys(req.body),
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
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
            
            // Log da exclusão
            await LoggingService.logUserAction({
                userId,
                profileId,
                actionType: ACTION_TYPES.PROFILE_DELETE,
                description: 'Profile deleted',
                metadata: {
                    soft_delete: true
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            // Log da falha na exclusão
            await LoggingService.logUserAction({
                userId: req.user.userId,
                profileId: req.params.profileId,
                actionType: ACTION_TYPES.PROFILE_DELETE,
                description: 'Profile deletion failed',
                metadata: {
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
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
            
            // Log da atualização de avatar
            await LoggingService.logUserAction({
                userId,
                profileId,
                actionType: ACTION_TYPES.AVATAR_UPDATE,
                description: 'Profile avatar updated',
                metadata: {
                    newAvatarId: avatar_id,
                    profileName: profile.nome
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Avatar atualizado com sucesso',
                data: profile
            });
        } catch (error) {
            // Log da falha na atualização do avatar
            await LoggingService.logUserAction({
                userId: req.user.userId,
                profileId: req.params.profileId,
                actionType: ACTION_TYPES.AVATAR_UPDATE,
                description: 'Avatar update failed',
                metadata: {
                    avatarId: req.body.avatar_id,
                    error: error.message
                },
                request: req,
                statusCode: 400
            });
            
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
            
            // Log da listagem de avatares
            await LoggingService.logUserAction({
                userId: req.user?.userId || null, // Pode ser chamado sem autenticação
                actionType: ACTION_TYPES.AVATARS_LIST,
                description: 'Available avatars listed',
                metadata: {
                    category: category || 'all',
                    avatarsCount: avatars.length
                },
                request: req,
                statusCode: 200
            });
            
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
            
            // Log da autenticação de perfil
            await LoggingService.logUserAction({
                userId: req.user.userId,
                profileId,
                actionType: ACTION_TYPES.PROFILE_AUTHENTICATE,
                description: 'Profile authenticated successfully',
                metadata: {
                    profileName: profile.nome,
                    hasPassword: !!senha
                },
                request: req,
                statusCode: 200
            });
            
            res.json({
                success: true,
                message: 'Perfil autenticado com sucesso',
                data: profile
            });
        } catch (error) {
            // Log da falha na autenticação
            await LoggingService.logUserAction({
                userId: req.user.userId,
                profileId: req.body.profileId,
                actionType: ACTION_TYPES.PROFILE_AUTHENTICATE,
                description: 'Profile authentication failed',
                metadata: {
                    error: error.message,
                    passwordProvided: !!req.body.senha
                },
                request: req,
                statusCode: 401
            });
            
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

            // Log do acesso ao perfil específico
            await LoggingService.logUserAction({
                userId: req.user.userId,
                profileId,
                actionType: ACTION_TYPES.PROFILE_ACCESS,
                description: 'Specific profile accessed',
                metadata: {
                    profileName: profile.nome,
                    profileType: profile.tipo
                },
                request: req,
                statusCode: 200
            });

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