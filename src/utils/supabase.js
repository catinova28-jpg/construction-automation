/**
 * Supabase клиент
 * Подключение к облачной базе данных
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../../config');
const logger = require('./logger');

let supabase = null;

function getSupabase() {
    if (supabase) return supabase;

    if (!config.supabase.url || !config.supabase.key) {
        logger.warn('Supabase', 'Не настроен — работаем только с JSON');
        return null;
    }

    try {
        supabase = createClient(config.supabase.url, config.supabase.key);
        logger.success('Supabase', 'Подключено к ' + config.supabase.url);
        return supabase;
    } catch (err) {
        logger.error('Supabase', 'Ошибка подключения', err.message);
        return null;
    }
}

module.exports = { getSupabase };
