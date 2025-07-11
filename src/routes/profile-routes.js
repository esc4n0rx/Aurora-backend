const express = require('express');
const ProfileController = require('../controllers/profile-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { validateData } = require('../middlewares/validation-middleware');
const { 
    createProfileValidation, 
    updateProfileValidation, 
    authenticateProfileValidation,
    updateAvatarValidation
} = require('../validations/profile-validations');

const router = express.Router();

// Rota pública para listar avatares disponíveis
router.get('/avatars', ProfileController.getAvailableAvatars);

// Todas as outras rotas de perfil requerem autenticação
router.use(authenticateToken);

// Listar perfis do usuário
router.get('/', ProfileController.getProfiles);

// Criar novo perfil
router.post('/', validateData(createProfileValidation), ProfileController.createProfile);

// Obter perfil por ID
router.get('/:profileId', ProfileController.getProfileById);

// Atualizar perfil
router.put('/:profileId', validateData(updateProfileValidation), ProfileController.updateProfile);

// Excluir perfil
router.delete('/:profileId', ProfileController.deleteProfile);

// Atualizar avatar do perfil
router.put('/:profileId/avatar', validateData(updateAvatarValidation), ProfileController.updateAvatar);

// Autenticar perfil (para perfis com senha)
router.post('/authenticate', validateData(authenticateProfileValidation), ProfileController.authenticateProfile);

module.exports = router;