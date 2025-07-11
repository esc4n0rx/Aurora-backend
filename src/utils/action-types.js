/**
 * Definições de tipos de ações para logs e métricas
 */

const ACTION_CATEGORIES = {
    AUTH: 'auth',
    PROFILE: 'profile',
    CONTENT: 'content',
    SYSTEM: 'system',
    SECURITY: 'security'
};

const ACTION_TYPES = {
    // Autenticação
    USER_REGISTER: 'user_register',
    USER_LOGIN: 'user_login',
    USER_LOGOUT: 'user_logout',
    EMAIL_CHECK: 'email_check',
    TOKEN_REFRESH: 'token_refresh',
    
    // Perfis
    PROFILE_CREATE: 'profile_create',
    PROFILE_UPDATE: 'profile_update',
    PROFILE_DELETE: 'profile_delete',
    PROFILE_ACCESS: 'profile_access',
    PROFILE_AUTHENTICATE: 'profile_authenticate',
    AVATAR_UPDATE: 'avatar_update',
    AVATARS_LIST: 'avatars_list',
    
    // Conteúdo (para futuro)
    CONTENT_VIEW: 'content_view',
    CONTENT_SEARCH: 'content_search',
    CONTENT_FAVORITE: 'content_favorite',
    
    // Sistema
    API_HEALTH_CHECK: 'api_health_check',
    API_DOCS_ACCESS: 'api_docs_access',
    
    // Segurança
    INVALID_TOKEN: 'invalid_token',
    RATE_LIMIT_HIT: 'rate_limit_hit',
    SUSPICIOUS_ACTIVITY: 'suspicious_activity'
};

/**
 * Mapear tipos de ação para suas categorias
 */
const getActionCategory = (actionType) => {
    const categoryMap = {
        [ACTION_TYPES.USER_REGISTER]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.USER_LOGIN]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.USER_LOGOUT]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.EMAIL_CHECK]: ACTION_CATEGORIES.AUTH,
        [ACTION_TYPES.TOKEN_REFRESH]: ACTION_CATEGORIES.AUTH,
        
        [ACTION_TYPES.PROFILE_CREATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_UPDATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_DELETE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_ACCESS]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.PROFILE_AUTHENTICATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.AVATAR_UPDATE]: ACTION_CATEGORIES.PROFILE,
        [ACTION_TYPES.AVATARS_LIST]: ACTION_CATEGORIES.PROFILE,
        
        [ACTION_TYPES.CONTENT_VIEW]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_SEARCH]: ACTION_CATEGORIES.CONTENT,
        [ACTION_TYPES.CONTENT_FAVORITE]: ACTION_CATEGORIES.CONTENT,
        
        [ACTION_TYPES.API_HEALTH_CHECK]: ACTION_CATEGORIES.SYSTEM,
        [ACTION_TYPES.API_DOCS_ACCESS]: ACTION_CATEGORIES.SYSTEM,
        
        [ACTION_TYPES.INVALID_TOKEN]: ACTION_CATEGORIES.SECURITY,
        [ACTION_TYPES.RATE_LIMIT_HIT]: ACTION_CATEGORIES.SECURITY,
        [ACTION_TYPES.SUSPICIOUS_ACTIVITY]: ACTION_CATEGORIES.SECURITY
    };
    
    return categoryMap[actionType] || ACTION_CATEGORIES.SYSTEM;
};

module.exports = {
    ACTION_CATEGORIES,
    ACTION_TYPES,
    getActionCategory
};