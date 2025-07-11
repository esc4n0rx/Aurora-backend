const { supabaseAdmin } = require('../config/database');

class UserModel {
    /**
     * Criar um novo usuário
     */
    static async create(userData) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .insert([userData])
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Buscar usuário por email
     */
    static async findByEmail(email) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = não encontrado
            throw error;
        }

        return data;
    }

    /**
     * Buscar usuário por ID
     */
    static async findById(id) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data;
    }

    /**
     * Verificar se email já existe
     */
    static async emailExists(email) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    }
}

module.exports = UserModel;