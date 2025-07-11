const { supabaseAdmin } = require('../config/database');

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
                is_active: true
            },
            {
                user_id: userId,
                nome: `${firstName} Kids`,
                tipo: 'kids',
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
}

module.exports = ProfileService;