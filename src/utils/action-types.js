/**
 * Definições de tipos de ações para logs e métricas
 */

const ACTION_CATEGORIES = {
    AUTH: 'auth',
    PROFILE: 'profile',
    CONTENT: 'content',
    STREAMING: 'streaming', // Nova categoria
    SYSTEM: 'system',
    SECURITY: 'security',
    ADMIN: 'admin'
};

const ACTION_TYPES = {
    // === AUTENTICAÇÃO ===
    USER_REGISTER: 'user_register',
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    EMAIL_CHECK: 'email_check',
    TOKEN_REFRESH: 'token_refresh',
    
    // === PERFIS ===
    PROFILE_CREATE: 'profile_create',
    PROFILE_UPDATE: 'profile_update',
    PROFILE_DELETE: 'profile_delete',
    PROFILE_ACCESS: 'profile_access',
    PROFILE_AUTHENTICATE: 'profile_authenticate',
    AVATAR_UPDATE: 'avatar_update',
    AVATARS_LIST: 'avatars_list',
    
    // === CONTEÚDO ===
    CONTENT_CREATE: 'content_create',
    CONTENT_UPDATE: 'content_update',
    CONTENT_DELETE: 'content_delete',
    CONTENT_LIST: 'content_list',
    CONTENT_ACCESS: 'content_access',
    CONTENT_VIEW: 'content_view',
    CONTENT_SEARCH: 'content_search',
    CONTENT_POPULAR: 'content_popular',
    CONTENT_STATS: 'content_stats',
    CONTENT_VIEW_STATS: 'content_view_stats',
    SERIES_EPISODES: 'series_episodes',
    
    // === STREAMING (NOVOS) ===
    STREAM_START: 'stream_start',
    STREAM_ACCESS: 'stream_access',
    STREAM_STOP: 'stream_stop',
    STREAM_INFO: 'stream_info',
    STREAM_STATS: 'stream_stats',
    TORRENT_DOWNLOAD: 'torrent_download',
    
    // === SISTEMA ===
    API_HEALTH_CHECK: 'api_health_check',
    API_DOCS_ACCESS: 'api_docs_access',
    
    // === SEGURANÇA ===
    INVALID_TOKEN: 'invalid_token',
    RATE_LIMIT_HIT: 'rate_limit_hit',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity',

    // === ADMINISTRAÇÃO - GERENCIAMENTO DE USUÁRIOS ===
    USER_LIST: 'user_list',
    USER_ACCESS: 'user_access',
    USER_BLOCK: 'user_block',
    USER_UNBLOCK: 'user_unblock',
    USER_DELETE: 'user_delete',
    USER_RESTORE: 'user_restore',
    
    // === ADMINISTRAÇÃO - LOGS E AUDITORIA ===
    LOGS_ACCESS: 'logs_access',
    LOGS_STATS: 'logs_stats',
    
    // === ADMINISTRAÇÃO - ESTATÍSTICAS DO SISTEMA ===
    SYSTEM_STATS: 'system_stats'
};

/**
 * Mapear tipos de ação para suas categorias
 */
const getActionCategory = (actionType) => {
    const categoryMap = {
        // Autenticação
        [ACTION_TYPES.USER_REGISTER]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.USER_LOGIN]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.USER_LOGOUT]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.EMAIL_CHECK]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.TOKEN_REFRESH]: ACTION_CATEGORIES.AUTH,
        
        // Perfis
        [ACTION_TYPES.PROFILE_CREATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_UPDATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_DELETE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_ACCESS]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_AUTHENTICATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.AVATAR_UPDATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.AVATARS_LIST]: ACTION_CATEGORIES.PROFILE,
        
        // Conteúdo
        [ACTION_TYPES.CONTENT_CREATE]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_UPDATE]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_DELETE]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_LIST]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_ACCESS]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_VIEW]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_SEARCH]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_POPULAR]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_STATS]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_VIEW_STATS]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.SERIES_EPISODES]: ACTION_CATEGORIES.CONTENT,
        
        // Streaming
        [ACTION_TYPES.STREAM_START]: ACTION_CATEGORIES.STREAMING,
        [ACTION_TYPES.STREAM_ACCESS]: ACTION_CATEGORIES.STREAMING,
        [ACTION_TYPES.STREAM_STOP]: ACTION_CATEGORIES.STREAMING,
        [ACTION_TYPES.STREAM_INFO]: ACTION_CATEGORIES.STREAMING,
        [ACTION_TYPES.STREAM_STATS]: ACTION_CATEGORIES.STREAMING,
        [ACTION_TYPES.TORRENT_DOWNLOAD]: ACTION_CATEGORIES.STREAMING,
        
        // Sistema
        [ACTION_TYPES.API_HEALTH_CHECK]: ACTION_CATEGORIES.SYSTEM,
        [ACTION_TYPES.API_DOCS_ACCESS]: ACTION_CATEGORIES.SYSTEM,
        
        // Segurança
        [ACTION_TYPES.INVALID_TOKEN]: ACTION_CATEGORIES.SECURITY,
        [ACTION_TYPES.RATE_LIMIT_HIT]: ACTION_CATEGORIES.SECURITY,
        [ACTION_TYPES.SUSPICIOUS_ACTIVITY]: ACTION_CATEGORIES.SECURITY,

        // Administração - Gerenciamento de usuários
        [ACTION_TYPES.USER_LIST]: ACTION_CATEGORIES.ADMIN,
        [ACTION_TYPES.USER_ACCESS]: ACTION_CATEGORIES.ADMIN,
        [ACTION_TYPES.USER_BLOCK]: ACTION_CATEGORIES.ADMIN,
        [ACTION_TYPES.USER_UNBLOCK]: ACTION_CATEGORIES.ADMIN,
        [ACTION_TYPES.USER_DELETE]: ACTION_CATEGORIES.ADMIN,
        [ACTION_TYPES.USER_RESTORE]: ACTION_CATEGORIES.ADMIN,
        
        // Administração - Logs e auditoria
        [ACTION_TYPES.LOGS_ACCESS]: ACTION_CATEGORIES.ADMIN,
        [ACTION_TYPES.LOGS_STATS]: ACTION_CATEGORIES.ADMIN,
        
        // Administração - Estatísticas do sistema
        [ACTION_TYPES.SYSTEM_STATS]: ACTION_CATEGORIES.ADMIN
    };
    
    return categoryMap[actionType] || ACTION_CATEGORIES.SYSTEM;
};

/**
 * Obter todos os tipos de ação por categoria
 */
const getActionTypesByCategory = (category) => {
    return Object.keys(ACTION_TYPES).filter(actionType => 
        getActionCategory(ACTION_TYPES[actionType]) === category
    ).map(actionType => ACTION_TYPES[actionType]);
};

/**
 * Verificar se um tipo de ação é válido
 */
const isValidActionType = (actionType) => {
    return Object.values(ACTION_TYPES).includes(actionType);
};

/**
 * Verificar se uma categoria é válida
 */
const isValidActionCategory = (category) => {
    return Object.values(ACTION_CATEGORIES).includes(category);
};

/**
 * Obter descrição amigável para tipo de ação
 */
const getActionTypeDescription = (actionType) => {
    const descriptions = {
        // Autenticação
        [ACTION_TYPES.USER_REGISTER]: 'Registro de usuário',
        [ACTION_TYPES.USER_LOGIN]: 'Login de usuário',
        [ACTION_TYPES.USER_LOGOUT]: 'Logout de usuário',
        [ACTION_TYPES.EMAIL_CHECK]: 'Verificação de email',
        [ACTION_TYPES.TOKEN_REFRESH]: 'Renovação de token',
        
        // Perfis
        [ACTION_TYPES.PROFILE_CREATE]: 'Criação de perfil',
        [ACTION_TYPES.PROFILE_UPDATE]: 'Atualização de perfil',
        [ACTION_TYPES.PROFILE_DELETE]: 'Exclusão de perfil',
        [ACTION_TYPES.PROFILE_ACCESS]: 'Acesso a perfil',
        [ACTION_TYPES.PROFILE_AUTHENTICATE]: 'Autenticação de perfil',
        [ACTION_TYPES.AVATAR_UPDATE]: 'Atualização de avatar',
        [ACTION_TYPES.AVATARS_LIST]: 'Listagem de avatares',
        
        // Conteúdo
        [ACTION_TYPES.CONTENT_CREATE]: 'Criação de conteúdo',
        [ACTION_TYPES.CONTENT_UPDATE]: 'Atualização de conteúdo',
        [ACTION_TYPES.CONTENT_DELETE]: 'Exclusão de conteúdo',
        [ACTION_TYPES.CONTENT_LIST]: 'Listagem de conteúdos',
        [ACTION_TYPES.CONTENT_ACCESS]: 'Acesso a conteúdo',
        [ACTION_TYPES.CONTENT_VIEW]: 'Visualização de conteúdo',
        [ACTION_TYPES.CONTENT_SEARCH]: 'Busca de conteúdo',
        [ACTION_TYPES.CONTENT_POPULAR]: 'Conteúdos populares',
        [ACTION_TYPES.CONTENT_STATS]: 'Estatísticas de conteúdo',
        [ACTION_TYPES.CONTENT_VIEW_STATS]: 'Estatísticas de visualização',
        [ACTION_TYPES.SERIES_EPISODES]: 'Episódios de série',
        
        // Sistema
        [ACTION_TYPES.API_HEALTH_CHECK]: 'Verificação de saúde da API',
        [ACTION_TYPES.API_DOCS_ACCESS]: 'Acesso à documentação',
        
        // Segurança
        [ACTION_TYPES.INVALID_TOKEN]: 'Token inválido',
        [ACTION_TYPES.RATE_LIMIT_HIT]: 'Limite de requisições atingido',
        [ACTION_TYPES.SUSPICIOUS_ACTIVITY]: 'Atividade suspeita',

        // Administração
        [ACTION_TYPES.USER_LIST]: 'Listagem de usuários (Admin)',
        [ACTION_TYPES.USER_ACCESS]: 'Acesso a usuário (Admin)',
        [ACTION_TYPES.USER_BLOCK]: 'Bloqueio de usuário (Admin)',
        [ACTION_TYPES.USER_UNBLOCK]: 'Desbloqueio de usuário (Admin)',
        [ACTION_TYPES.USER_DELETE]: 'Remoção de usuário (Admin)',
        [ACTION_TYPES.USER_RESTORE]: 'Restauração de usuário (Admin)',
        [ACTION_TYPES.LOGS_ACCESS]: 'Acesso aos logs (Admin)',
        [ACTION_TYPES.LOGS_STATS]: 'Estatísticas de logs (Admin)',
        [ACTION_TYPES.SYSTEM_STATS]: 'Estatísticas do sistema (Admin)'
    };
    
    return descriptions[actionType] || 'Ação desconhecida';
};

/**
 * Obter descrição amigável para categoria
 */
const getActionCategoryDescription = (category) => {
    const descriptions = {
        [ACTION_CATEGORIES.AUTH]: 'Autenticação',
        [ACTION_CATEGORIES.PROFILE]: 'Perfis',
        [ACTION_CATEGORIES.CONTENT]: 'Conteúdo',
        [ACTION_CATEGORIES.SYSTEM]: 'Sistema',
        [ACTION_CATEGORIES.SECURITY]: 'Segurança',
        [ACTION_CATEGORIES.ADMIN]: 'Administração'
    };
    
    return descriptions[category] || 'Categoria desconhecida';
};

module.exports = {
    ACTION_CATEGORIES,
    ACTION_TYPES,
    getActionCategory,
    getActionTypesByCategory,
    isValidActionType,
    isValidActionCategory,
    getActionTypeDescription,
    getActionCategoryDescription
};