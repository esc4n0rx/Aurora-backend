const { z } = require('zod');

// Validação para criação de perfil
const createProfileValidation = z.object({
    nome: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(50, 'Nome deve ter no máximo 50 caracteres')
        .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
    
    tipo: z.enum(['principal', 'kids'], {
        errorMap: () => ({ message: 'Tipo deve ser "principal" ou "kids"' })
    }),
    
    senha: z.string()
        .min(4, 'Senha deve ter pelo menos 4 caracteres')
        .max(20, 'Senha deve ter no máximo 20 caracteres')
        .optional(),
    
    avatar_id: z.string()
        .regex(/^[a-zA-Z0-9\-_]+$/, 'ID do avatar deve conter apenas letras, números, hífens e underscores')
        .optional()
});

// Validação para atualização de perfil
const updateProfileValidation = z.object({
    nome: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(50, 'Nome deve ter no máximo 50 caracteres')
        .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços')
        .optional(),
    
    senha: z.string()
        .min(4, 'Senha deve ter pelo menos 4 caracteres')
        .max(20, 'Senha deve ter no máximo 20 caracteres')
        .optional(),
    
    avatar_id: z.string()
        .regex(/^[a-zA-Z0-9\-_]+$/, 'ID do avatar deve conter apenas letras, números, hífens e underscores')
        .optional()
});

// Validação para atualização de avatar
const updateAvatarValidation = z.object({
    avatar_id: z.string()
        .min(1, 'ID do avatar é obrigatório')
        .regex(/^[a-zA-Z0-9\-_]+$/, 'ID do avatar deve conter apenas letras, números, hífens e underscores')
});

// Validação para autenticação de perfil
const authenticateProfileValidation = z.object({
    profileId: z.string().uuid('ID do perfil deve ser um UUID válido'),
    senha: z.string().min(1, 'Senha é obrigatória')
});

module.exports = {
    createProfileValidation,
    updateProfileValidation,
    updateAvatarValidation,
    authenticateProfileValidation
};