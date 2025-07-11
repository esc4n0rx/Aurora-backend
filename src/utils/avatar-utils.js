const fs = require('fs');
const path = require('path');

class AvatarUtils {
    /**
     * Pasta onde ficam os avatares
     */
    static AVATARS_PATH = path.join(__dirname, '../assets/avatars');
    
    /**
     * Avatares padrão para cada tipo
     */
    static DEFAULT_AVATARS = {
        'principal': 'default-profile.png',
        'kids': 'default-kids.png'
    };

    /**
     * Obter lista de avatares disponíveis
     */
    static getAvailableAvatars() {
        try {
            const files = fs.readdirSync(this.AVATARS_PATH);
            
            const avatars = files
                .filter(file => {
                    // Aceitar apenas arquivos PNG e JPG
                    const ext = path.extname(file).toLowerCase();
                    return ['.png', '.jpg', '.jpeg'].includes(ext);
                })
                .map(file => {
                    const name = path.parse(file).name;
                    const category = this.categorizeAvatar(file);
                    
                    return {
                        id: name,
                        filename: file,
                        url: `/assets/avatars/${file}`,
                        category: category,
                        isDefault: Object.values(this.DEFAULT_AVATARS).includes(file)
                    };
                });

            return avatars;
        } catch (error) {
            console.error('Erro ao ler pasta de avatares:', error);
            return [];
        }
    }

    /**
     * Categorizar avatar baseado no nome do arquivo
     */
    static categorizeAvatar(filename) {
        const name = filename.toLowerCase();
        
        if (name.includes('kids') || name.includes('child')) {
            return 'kids';
        }
        
        if (name.includes('default')) {
            return name.includes('kids') ? 'kids' : 'principal';
        }
        
        return 'general';
    }

    /**
     * Validar se o avatar existe e é seguro
     */
    static isValidAvatar(avatarId) {
        if (!avatarId || typeof avatarId !== 'string') {
            return false;
        }

        // Sanitizar o input - apenas alfanuméricos, hífens e underscores
        const sanitized = avatarId.replace(/[^a-zA-Z0-9\-_]/g, '');
        if (sanitized !== avatarId) {
            return false;
        }

        // Verificar se o arquivo existe
        const availableAvatars = this.getAvailableAvatars();
        return availableAvatars.some(avatar => avatar.id === avatarId);
    }

    /**
     * Obter URL completa do avatar
     */
    static getAvatarUrl(avatarId) {
        if (!this.isValidAvatar(avatarId)) {
            return null;
        }

        const availableAvatars = this.getAvailableAvatars();
        const avatar = availableAvatars.find(a => a.id === avatarId);
        
        return avatar ? avatar.url : null;
    }

    /**
     * Obter avatar padrão para um tipo
     */
    static getDefaultAvatarUrl(tipo) {
        const defaultFile = this.DEFAULT_AVATARS[tipo] || this.DEFAULT_AVATARS['principal'];
        return `/assets/avatars/${defaultFile}`;
    }

    /**
     * Obter avatar padrão ID para um tipo
     */
    static getDefaultAvatarId(tipo) {
        const defaultFile = this.DEFAULT_AVATARS[tipo] || this.DEFAULT_AVATARS['principal'];
        return path.parse(defaultFile).name;
    }

    /**
     * Filtrar avatares por categoria
     */
    static getAvatarsByCategory(category) {
        const allAvatars = this.getAvailableAvatars();
        
        if (category === 'all') {
            return allAvatars;
        }
        
        return allAvatars.filter(avatar => 
            avatar.category === category || avatar.category === 'general'
        );
    }

    /**
     * Obter informações de um avatar específico
     */
    static getAvatarInfo(avatarId) {
        const availableAvatars = this.getAvailableAvatars();
        return availableAvatars.find(avatar => avatar.id === avatarId) || null;
    }
}

module.exports = AvatarUtils;