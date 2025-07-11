const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Configurações do Supabase não encontradas nas variáveis de ambiente');
}

// Cliente para operações administrativas (service role)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Cliente para operações públicas (anon key)
const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);

module.exports = {
    supabaseAdmin,
    supabaseClient
};