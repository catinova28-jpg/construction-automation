/**
 * Отправка ссылки на видео о технологии СИП
 * Реальная ссылка на видео ПСК ХОРС
 */

const logger = require('../utils/logger');

class VideoSender {
    constructor() {
        this.videoUrl = 'https://asmplus.bitrix24.ru/~33XOf';
    }

    /**
     * Отправить приветственное сообщение + ссылку на видео
     */
    async send(chatId, bot, clientName) {
        const message =
            '🏗️ ПСК «ХОРС» — строим дома из СИП панелей уже 17 лет.\n\n' +
            '📹 Пока готовим ваше КП, посмотрите видео о нашей технологии:\n' +
            '👉 ' + this.videoUrl;

        if (bot && typeof bot.sendMessage === 'function') {
            try {
                await bot.sendMessage(chatId, message);
                logger.success('VideoSender', 'Приветствие + видео отправлены клиенту ' + (clientName || chatId));
            } catch (err) {
                logger.error('VideoSender', 'Ошибка отправки видео', err.message);
            }
        } else {
            logger.demo('VideoSender', 'Приветствие + видео → чат ' + chatId);
        }
    }
}

module.exports = new VideoSender();
