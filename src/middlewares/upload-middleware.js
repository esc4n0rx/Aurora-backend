const multer = require('multer');
const FileUtils = require('../utils/file-utils');

// Configuração do multer para memória (não salvar no disco)
const storage = multer.memoryStorage();

// Filtro para validar arquivos
const fileFilter = (req, file, cb) => {
    if (FileUtils.isValidFileType(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de arquivo não permitido. Use apenas PNG, JPG ou JPEG.'), false);
    }
};

// Configuração do upload
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: FileUtils.MAX_SIZE
    }
});

/**
 * Middleware para upload de avatar
 */
const uploadAvatar = upload.single('avatar');

/**
 * Middleware para tratar erros de upload
 */
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Arquivo muito grande. Tamanho máximo: 2MB'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'Erro no upload do arquivo'
        });
    }
    
    if (err.message.includes('Tipo de arquivo não permitido')) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    next(err);
};

module.exports = {
    uploadAvatar,
    handleUploadError
};