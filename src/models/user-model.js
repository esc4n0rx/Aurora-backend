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
            .eq('is_deleted', false)
            .single();

        if (error && error.code !== 'PGRST116') {
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
            .eq('is_deleted', false)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return data;
    }

    /**
     * Buscar usuário por ID incluindo deletados (para admin)
     */
    static async findByIdIncludingDeleted(id) {
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
     * Buscar usuário por ID com detalhes completos (para admin)
     */
    static async findByIdWithDetails(id) {
        const { data, error } = await supabaseAdmin
            .from('users_with_stats')
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
            .eq('is_deleted', false)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        return !!data;
    }

    /**
     * Listar usuários com filtros (para admin)
     */
    static async findManyWithFilters(filters) {
        const {
            search,
            status,
            limit,
            offset,
            sort_by,
            sort_order
        } = filters;

        let query = supabaseAdmin
            .from('users_with_stats')
            .select('*', { count: 'exact' });

        // Filtro por status
        switch (status) {
            case 'active':
                query = query.eq('is_blocked', false).eq('is_deleted', false);
                break;
            case 'blocked':
                query = query.eq('is_blocked', true).eq('is_deleted', false);
                break;
            case 'deleted':
                query = query.eq('is_deleted', true);
                break;
            default:
                // 'all' - não adiciona filtro
                break;
        }

        // Busca textual
        if (search) {
            query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
        }

        // Ordenação
        query = query.order(sort_by, { ascending: sort_order === 'asc' });

        // Paginação
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        return {
            data,
            total: count,
            limit,
            offset
        };
    }

    /**
     * Bloquear usuário
     */
    static async blockUser(userId, reason, adminUserId) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                is_blocked: true,
                blocked_reason: reason,
                blocked_at: new Date().toISOString(),
                blocked_by: adminUserId,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Desbloquear usuário
     */
    static async unblockUser(userId, adminUserId) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                is_blocked: false,
                blocked_reason: null,
                blocked_at: null,
                blocked_by: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Remover usuário (soft delete)
     */
    static async deleteUser(userId, adminUserId) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: adminUserId,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Restaurar usuário deletado
     */
    static async restoreUser(userId, adminUserId) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .update({
                is_deleted: false,
                deleted_at: null,
                deleted_by: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return data;
    }

    /**
     * Obter estatísticas de usuários
     */
    static async getUserStats() {
        const { data: totalUsers } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false);

        const { data: activeUsers } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false)
            .eq('is_blocked', false);

        const { data: blockedUsers } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
            .eq('is_deleted', false)
            .eq('is_blocked', true);

        const { data: deletedUsers } = await supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' })
           .eq('is_deleted', true);

       // Usuários registrados na última semana
       const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
       const { data: newUsers } = await supabaseAdmin
           .from('users')
           .select('*', { count: 'exact' })
           .eq('is_deleted', false)
           .gte('created_at', lastWeek);

       return {
           total: totalUsers.length,
           active: activeUsers.length,
           blocked: blockedUsers.length,
           deleted: deletedUsers.length,
           newLastWeek: newUsers.length
       };
   }
}

module.exports = UserModel;