/**
 * Уведомления менеджеру в Telegram
 * Отправляет сводки о лидах в группу/чат менеджера
 * Использует тот же токен бота ПСК «ХОРС»
 */

const config = require('../../config');
const logger = require('../utils/logger');

class TelegramNotifier {
    constructor() {
        this.bot = null;
        this.chatId = null;
    }

    /**
     * Инициализация — вызывается после запуска бота
     */
    init(botInstance) {
        this.chatId = config.notifications?.chatId;

        if (!this.chatId) {
            logger.demo('Notifier', 'Уведомления выключены (нет TELEGRAM_NOTIFY_CHAT_ID)');
            return;
        }

        if (botInstance) {
            this.bot = botInstance;
            logger.success('Notifier', `Уведомления → чат ${this.chatId}`);
        } else if (config.hasTelegram()) {
            // Создаём отдельный экземпляр для отправки, если бот не передан
            try {
                const TelegramBotAPI = require('node-telegram-bot-api');
                this.bot = new TelegramBotAPI(config.telegram.token);
                logger.success('Notifier', `Уведомления → чат ${this.chatId} (отдельный экземпляр)`);
            } catch (err) {
                logger.error('Notifier', 'Не удалось создать бота для уведомлений', err.message);
            }
        } else {
            logger.demo('Notifier', 'Уведомления в демо-режиме (нет TELEGRAM_BOT_TOKEN)');
        }
    }

    /**
     * 📄 Уведомление: КП отправлено
     */
    async notifyKPSent(leadData, kpUrl) {
        const temperatureEmoji = this._getTemperatureEmoji(leadData.temperature);
        const services = (leadData.serviceNames || []).join(', ') || 'стандартный набор';

        const floorsMap = { '1': '1 этаж', '1.5': '1.5 этажа (мансарда)', '2': '2 этажа' };
        const floorsLabel = floorsMap[leadData.floors] || leadData.floors || '—';

        const totalCash = (leadData.totalCash || leadData.estimatedCost || 0).toLocaleString('ru-RU');

        const source = this._getSourceLabel(leadData.source);

        const msg = `📄 *КП ОТПРАВЛЕНО* ${source}
━━━━━━━━━━━━━━━━━
👤 *${leadData.name || 'Без имени'}*
📐 Площадь: ${leadData.area || '?'} м²
🏠 Дом: ${floorsLabel}
🔧 Услуги: ${services}
📍 Район: ${leadData.location || 'не указан'}
📱 Тел: ${leadData.phone || 'не указан'}
💰 Стоимость: *${totalCash} ₽*
${temperatureEmoji}
📄 КП: ${kpUrl || '—'}
━━━━━━━━━━━━━━━━━`;

        await this._send(msg);
    }

    /**
     * 📞 Уведомление: клиент хочет созвониться
     */
    async notifyCallbackRequest(data) {
        const msg = `📞 *ЗАПРОС НА ЗВОНОК*
━━━━━━━━━━━━━━━━━
👤 *${data.name || 'Клиент'}*
📱 Тел: *${data.phone || 'не указан'}*
💬 Контекст: ${data.context || 'клиент просит перезвонить'}
📍 Источник: ${this._getSourceLabel(data.source)}
━━━━━━━━━━━━━━━━━
⚡ *Требуется связаться с клиентом!*`;

        await this._send(msg);
    }

    /**
     * 🔧 Уведомление: индивидуальный запрос
     */
    async notifyCustomRequest(data) {
        const msg = `🔧 *ИНДИВИДУАЛЬНЫЙ ЗАПРОС*
━━━━━━━━━━━━━━━━━
👤 *${data.name || 'Клиент'}*
📱 Тел: ${data.phone || 'не указан'}
💬 Запрос: ${data.request || data.context || 'индивидуальный проект'}
📍 Источник: ${this._getSourceLabel(data.source)}
━━━━━━━━━━━━━━━━━
⚡ *Требуется внимание менеджера!*`;

        await this._send(msg);
    }

    /**
     * Отправить сообщение в чат менеджера
     */
    async _send(text) {
        if (!this.chatId) return;

        if (this.bot) {
            try {
                await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
                logger.success('Notifier', 'Уведомление отправлено');
            } catch (err) {
                // Если Markdown не парсится — отправляем без форматирования
                logger.error('Notifier', 'Markdown ошибка, отправляю без форматирования', err.message);
                try {
                    const plainText = text.replace(/\*/g, '').replace(/_/g, '');
                    await this.bot.sendMessage(this.chatId, plainText);
                    logger.success('Notifier', 'Уведомление отправлено (plain text)');
                } catch (err2) {
                    logger.error('Notifier', 'Ошибка отправки уведомления', err2.message);
                }
            }
        } else {
            logger.demo('Notifier', `[→ ${this.chatId}] ${text.replace(/\*/g, '').substring(0, 120)}...`);
        }
    }

    /**
     * Получить emoji температуры
     */
    _getTemperatureEmoji(temperature) {
        if (!temperature) return '🌡️ Температура: не определена';
        const t = parseInt(temperature);
        if (t >= 80) return `🌡️ Температура: 🔥🔥🔥 *Горячий* (${t}/100)`;
        if (t >= 60) return `🌡️ Температура: 🔥🔥 *Тёплый* (${t}/100)`;
        if (t >= 40) return `🌡️ Температура: 🔥 *Умеренный* (${t}/100)`;
        return `🌡️ Температура: ❄️ *Холодный* (${t}/100)`;
    }

    /**
     * Получить label источника
     */
    _getSourceLabel(source) {
        const labels = {
            'neuroagents-avito': '(Авито)',
            'bitrix24': '(Битрикс24)',
            'telegram': '(Telegram-бот)',
        };
        return labels[source] || '';
    }
}

module.exports = new TelegramNotifier();
