/**
 * Планировщик — таймер 1 час после создания лида
 * Запускает генерацию КП и отправку видео
 */

const logger = require('../utils/logger');

class Scheduler {
    constructor() {
        this.timers = new Map();
        this.onTimerComplete = null; // callback
    }

    /**
     * Установить обработчик завершения таймера
     */
    setHandler(handler) {
        this.onTimerComplete = handler;
    }

    /**
     * Запланировать обработку лида через указанное время
     * @param {string} leadId - ID лида
     * @param {object} leadData - данные лида
     * @param {number} delayMs - задержка в мс (по умолчанию 1 час, в демо — 10 сек)
     */
    schedule(leadId, leadData, delayMs) {
        // В демо-режиме: 10 секунд вместо часа
        const actualDelay = delayMs || 10000;
        const delayLabel = actualDelay >= 60000
            ? `${Math.round(actualDelay / 60000)} мин.`
            : `${Math.round(actualDelay / 1000)} сек.`;

        logger.info('Scheduler', `⏰ Таймер установлен для лида ${leadId}: ${delayLabel}`);

        const timer = setTimeout(async () => {
            logger.info('Scheduler', `⏰ Таймер сработал для лида ${leadId}`);
            this.timers.delete(leadId);

            if (this.onTimerComplete) {
                try {
                    await this.onTimerComplete(leadId, leadData);
                } catch (err) {
                    logger.error('Scheduler', `Ошибка обработки таймера для ${leadId}`, err.message);
                }
            }
        }, actualDelay);

        this.timers.set(leadId, timer);
    }

    /**
     * Отменить таймер
     */
    cancel(leadId) {
        const timer = this.timers.get(leadId);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(leadId);
            logger.info('Scheduler', `Таймер отменён для ${leadId}`);
        }
    }

    /**
     * Количество активных таймеров
     */
    get activeCount() {
        return this.timers.size;
    }
}

module.exports = new Scheduler();
