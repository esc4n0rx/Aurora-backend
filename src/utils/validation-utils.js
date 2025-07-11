/**
 * Utilitários para validação customizada
 */

/**
 * Validar se uma string é um endereço IP válido (IPv4 ou IPv6)
 */
const isValidIP = (ip) => {
    // IPv4
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 (básico)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    
    // IPv6 comprimido (mais complexo)
    const ipv6CompressedRegex = /^(([0-9a-fA-F]{1,4}:){1,7}:|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ipv6CompressedRegex.test(ip);
};

/**
 * Validar se uma string é um User-Agent válido
 */
const isValidUserAgent = (userAgent) => {
    if (!userAgent || typeof userAgent !== 'string') {
        return false;
    }
    
    // User-Agent deve ter pelo menos algumas características básicas
    return userAgent.length > 5 && userAgent.length < 1000;
};

/**
 * Validar se uma string é um endpoint válido
 */
const isValidEndpoint = (endpoint) => {
    if (!endpoint || typeof endpoint !== 'string') {
        return false;
    }
    
    // Deve começar com / e ter formato de URL path
    const endpointRegex = /^\/[a-zA-Z0-9\/_\-\.\?&=]*$/;
    return endpointRegex.test(endpoint) && endpoint.length <= 200;
};

module.exports = {
    isValidIP,
    isValidUserAgent,
    isValidEndpoint
};