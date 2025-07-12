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
        try {
            // Buscar da tabela normal de usuários primeiro
            const { data: user, error: userError } = await supabaseAdmin
                .from('users')
                .select('*')
                .eq('id', id)
                .single();

            if (userError && userError.code !== 'PGRST116') {
                throw userError;
            }

            if (!user) {
                return null;
            }

            // Buscar estatísticas adicionais manualmente
            const [profilesResult, actionsResult] = await Promise.all([
                supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('user_id', id)
                    .eq('is_active', true),
                supabaseAdmin
                    .from('user_actions')
                    .select('id, created_at')
                    .eq('user_id', id)
                    .order('created_at', { ascending: false })
                    .limit(1)
            ]);

            // Adicionar estatísticas calculadas
            const userWithStats = {
                ...user,
                profiles_count: profilesResult.data?.length || 0,
                actions_count: 0, // Placeholder - pode ser calculado se necessário
                last_activity: actionsResult.data?.[0]?.created_at || null
            };

            return userWithStats;
        } catch (error) {
            console.error('Error in findByIdWithDetails:', error);
            throw error;
        }
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
        try {
            const {
                search,
                status,
                limit = 20,
                offset = 0,
                sort_by = 'created_at',
                sort_order = 'desc'
            } = filters;

            console.log('Filters received:', filters); // Debug log

            // Começar com query básica
            let query = supabaseAdmin
                .from('users')
                .select('*', { count: 'exact' });

            // Aplicar filtros de status
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
                case 'all':
                default:
                    // Não adicionar filtro - mostrar todos
                    break;
            }

            // Busca textual
            if (search && search.trim()) {
                query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
            }

            // Ordenação
            const validSortFields = ['nome', 'email', 'created_at', 'updated_at'];
            const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
            const sortDirection = sort_order === 'asc';
            
            query = query.order(sortField, { ascending: sortDirection });

            // Paginação
            query = query.range(offset, offset + limit - 1);

            console.log('Executing query with:', { 
                status, 
                search, 
                sortField, 
                sortDirection, 
                limit, 
                offset 
            }); // Debug log

            const { data, error, count } = await query;

            if (error) {
                console.error('Supabase query error:', error);
                throw error;
            }

            // Enriquecer dados dos usuários com estatísticas básicas
            const enrichedData = await Promise.all(
                data.map(async (user) => {
                    try {
                        // Buscar contagem de perfis
                        const { data: profiles } = await supabaseAdmin
                            .from('profiles')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('is_active', true);

                        // Buscar última atividade
                        const { data: lastAction } = await supabaseAdmin
                            .from('user_actions')
                            .select('created_at')
                            .eq('user_id', user.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        return {
                            ...user,
                            profiles_count: profiles?.length || 0,
                            actions_count: 0, // Placeholder
                            last_activity: lastAction?.created_at || null
                        };
                    } catch (enrichError) {
                        console.warn('Error enriching user data:', enrichError);
                        return {
                            ...user,
                            profiles_count: 0,
                            actions_count: 0,
                            last_activity: null
                        };
                    }
                })
            );

            return {
                data: enrichedData,
                total: count || 0,
                limit,
                offset
            };
        } catch (error) {
            console.error('Error in findManyWithFilters:', error);
            throw error;
        }
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
        try {
            const [totalResult, activeResult, blockedResult, deletedResult] = await Promise.all([
                supabaseAdmin
                    .from('users')
                    .select('*', { count: 'exact' })
                    .eq('is_deleted', false),
                supabaseAdmin
                    .from('users')
                    .select('*', { count: 'exact' })
                    .eq('is_deleted', false)
                    .eq('is_blocked', false),
                supabaseAdmin
                    .from('users')
                    .select('*', { count: 'exact' })
                    .eq('is_deleted', false)
                    .eq('is_blocked', true),
                supabaseAdmin
                    .from('users')
                    .select('*', { count: 'exact' })
                    .eq('is_deleted', true)
            ]);

            // Usuários registrados na última semana
            const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { count: newUsersCount } = await supabaseAdmin
                .from('users')
                .select('*', { count: 'exact' })
                .eq('is_deleted', false)
                .gte('created_at', lastWeek);

            return {
                total: totalResult.count || 0,
                active: activeResult.count || 0,
                blocked: blockedResult.count || 0,
                deleted: deletedResult.count || 0,
                newLastWeek: newUsersCount || 0
            };
        } catch (error) {
            console.error('Error getting user stats:', error);
            throw error;
        }
    }
}

module.exports = UserModel;