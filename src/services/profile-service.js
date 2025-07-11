const { supabaseAdmin } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/password-utils');
const AvatarUtils = require('../utils/avatar-utils');

class ProfileService {
    /**
     * Criar perfis padrão para um usuário (principal e kids)
     */
    static async createDefaultProfiles(userId, userName) {
        const firstName = userName.split(' ')[0];
        
        const profiles = [
            {
                user_id: userId,
                nome: firstName,
                tipo: 'principal',
                avatar_id: AvatarUtils.getDefaultAvatarId('principal'),
                avatar_url: AvatarUtils.getDefaultAvatarUrl('principal'),
                is_active: true
            },
            {
                user_id: userId,
                nome: `${firstName} Kids`,
                tipo: 'kids',
                avatar_id: AvatarUtils.getDefaultAvatarId('kids'),
                avatar_url: AvatarUtils.getDefaultAvatarUrl('kids'),
                is_active: true
            }
        ];

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .insert(profiles)
            .select();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar perfis de um usuário
     */
    static async getProfilesByUserId(userId) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Criar um novo perfil
     */
    static async createProfile(userId, profileData) {
        const { nome, tipo, senha, avatar_id } = profileData;
        
        // Verificar se já existe 4 perfis (limite)
        const existingProfiles = await this.getProfilesByUserId(userId);
        if (existingProfiles.length >= 4) {
            throw new Error('Limite máximo de 4 perfis atingido');
        }

        // Validar avatar se fornecido
        let avatarId = avatar_id;
        if (avatarId && !AvatarUtils.isValidAvatar(avatarId)) {
            throw new Error('Avatar selecionado é inválido');
        }

        // Usar avatar padrão se não fornecido
        if (!avatarId) {
            avatarId = AvatarUtils.getDefaultAvatarId(tipo);
        }

        // Preparar dados do perfil
        const newProfile = {
            user_id: userId,
            nome,
            tipo,
            avatar_id: avatarId,
            avatar_url: AvatarUtils.getAvatarUrl(avatarId),
            is_active: true
        };

        // Criptografar senha se fornecida
        if (senha) {
            newProfile.senha = await hashPassword(senha);
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .insert([newProfile])
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Remover senha da resposta
        const { senha: _, ...profileWithoutPassword } = data;
        return profileWithoutPassword;
    }

    /**
     * Atualizar perfil
     */
    static async updateProfile(userId, profileId, updateData) {
        const { nome, senha, avatar_id } = updateData;
        
        // Verificar se o perfil pertence ao usuário
        const profile = await this.getProfileById(profileId);
        if (!profile || profile.user_id !== userId) {
            throw new Error('Perfil não encontrado ou não pertence ao usuário');
        }

        const updateFields = {};
        
        if (nome) updateFields.nome = nome;
        if (senha) updateFields.senha = await hashPassword(senha);
        
        // Validar e atualizar avatar se fornecido
        if (avatar_id) {
            if (!AvatarUtils.isValidAvatar(avatar_id)) {
                throw new Error('Avatar selecionado é inválido');
            }
            updateFields.avatar_id = avatar_id;
            updateFields.avatar_url = AvatarUtils.getAvatarUrl(avatar_id);
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updateFields)
            .eq('id', profileId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Remover senha da resposta
        const { senha: _, ...profileWithoutPassword } = data;
        return profileWithoutPassword;
    }

    /**
     * Excluir perfil
     */
    static async deleteProfile(userId, profileId) {
        // Verificar se o perfil pertence ao usuário
        const profile = await this.getProfileById(profileId);
        if (!profile || profile.user_id !== userId) {
            throw new Error('Perfil não encontrado ou não pertence ao usuário');
        }

        // Não permitir excluir se for o único perfil
        const userProfiles = await this.getProfilesByUserId(userId);
        if (userProfiles.length <= 1) {
            throw new Error('Não é possível excluir o último perfil');
        }

        // Marcar como inativo em vez de excluir
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({ is_active: false })
            .eq('id', profileId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return { message: 'Perfil excluído com sucesso' };
    }

    /**
     * Atualizar avatar do perfil
     */
    static async updateAvatar(userId, profileId, avatarId) {
        // Verificar se o perfil pertence ao usuário
        const profile = await this.getProfileById(profileId);
        if (!profile || profile.user_id !== userId) {
            throw new Error('Perfil não encontrado ou não pertence ao usuário');
        }

        // Validar avatar
        if (!AvatarUtils.isValidAvatar(avatarId)) {
            throw new Error('Avatar selecionado é inválido');
        }

        // Atualizar avatar no banco
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update({ 
                avatar_id: avatarId,
                avatar_url: AvatarUtils.getAvatarUrl(avatarId)
            })
            .eq('id', profileId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Remover senha da resposta
        const { senha: _, ...profileWithoutPassword } = data;
        return profileWithoutPassword;
    }

    /**
     * Obter avatares disponíveis
     */
    static async getAvailableAvatars(category = 'all') {
        return AvatarUtils.getAvatarsByCategory(category);
    }

    /**
     * Autenticar perfil com senha
     */
    static async authenticateProfile(profileId, senha) {
        const profile = await this.getProfileById(profileId);
        
        if (!profile) {
            throw new Error('Perfil não encontrado');
        }

        // Se perfil não tem senha, permitir acesso
        if (!profile.senha) {
            const { senha: _, ...profileWithoutPassword } = profile;
            return profileWithoutPassword;
        }

        // Verificar senha
        const isPasswordValid = await comparePassword(senha, profile.senha);
        if (!isPasswordValid) {
            throw new Error('Senha incorreta');
        }

        // Remover senha da resposta
        const { senha: _, ...profileWithoutPassword } = profile;
        return profileWithoutPassword;
    }

    /**
     * Buscar perfil por ID
     */
    static async getProfileById(profileId) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data;
    }
}

module.exports = ProfileService;