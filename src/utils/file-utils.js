const path = require('path');
const { supabaseAdmin } = require('../config/database');

class FileUtils {
    /**
     * Tipos de arquivo permitidos
     */
    static ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
    
    /**
     * Tamanho máximo do arquivo (2MB)
     */
    static MAX_SIZE = 2 * 1024 * 1024;

    /**
     * Validar tipo de arquivo
     */
    static isValidFileType(mimetype) {
        return this.ALLOWED_TYPES.includes(mimetype);
    }

    /**
     * Validar tamanho do arquivo
     */
    static isValidFileSize(size) {
        return size <= this.MAX_SIZE;
    }

    /**
     * Gerar nome único para arquivo
     */
    static generateUniqueFileName(originalName, userId, profileId) {
        const timestamp = Date.now();
        const extension = path.extname(originalName);
        return `profiles/${userId}/${profileId}_${timestamp}${extension}`;
    }

    /**
     * Upload de arquivo para Supabase Storage
     */
    static async uploadToSupabase(file, fileName) {
        const { data, error } = await supabaseAdmin.storage
            .from('avatars')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            throw new Error(`Erro ao fazer upload: ${error.message}`);
        }

        // Obter URL pública
        const { data: publicData } = supabaseAdmin.storage
            .from('avatars')
            .getPublicUrl(fileName);

        return publicData.publicUrl;
    }

    /**
     * Deletar arquivo do Supabase Storage
     */
    static async deleteFromSupabase(fileName) {
        const { error } = await supabaseAdmin.storage
            .from('avatars')
            .remove([fileName]);

        if (error) {
            throw new Error(`Erro ao deletar arquivo: ${error.message}`);
        }
    }

    /**
     * Obter URL da imagem padrão
     */
    static getDefaultAvatarUrl(tipo) {
        const defaultImages = {
            'principal': '/assets/default-avatars/default-profile.png',
            'kids': '/assets/default-avatars/default-kids.png'
        };
        
        return defaultImages[tipo] || defaultImages['principal'];
    }
}

module.exports = FileUtils;