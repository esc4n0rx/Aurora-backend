const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * Criptografa uma senha
 */
const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verifica se uma senha corresponde ao hash
 */
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

module.exports = {
    hashPassword,
    comparePassword
};