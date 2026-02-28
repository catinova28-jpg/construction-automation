/**
 * Интеграция с Битрикс24 CRM
 * В демо-режиме — всё логируется локально
 */

const config = require('../../config');
const logger = require('../utils/logger');

class Bitrix24 {
    constructor() {
        this.isDemo = !config.hasBitrix();
        if (this.isDemo) {
            logger.demo('Bitrix24', 'Работа в демо-режиме (нет BITRIX24_WEBHOOK_URL)');
        }
    }

    /**
     * Создать лид/сделку в CRM
     */
    async createDeal(leadData) {
        if (this.isDemo) {
            const dealId = `DEMO-${Date.now()}`;
            logger.demo('Bitrix24', `Создана сделка ${dealId}`, {
                name: leadData.name,
                services: leadData.services,
                budget: leadData.budget,
            });
            return {
                id: dealId,
                status: 'NEW',
                created: new Date().toISOString(),
            };
        }

        // === Реальная интеграция ===
        try {
            const response = await fetch(`${config.bitrix24.webhookUrl}/crm.deal.add.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: {
                        TITLE: `ПСК ХОРС — ${leadData.name}`,
                        NAME: leadData.name,
                        PHONE: [{ VALUE: leadData.phone, VALUE_TYPE: 'MOBILE' }],
                        OPPORTUNITY: leadData.budget,
                        COMMENTS: `Услуги: ${leadData.serviceNames.join(', ')}\nПлощадь: ${leadData.area} м²\nАдрес: ${leadData.location}`,
                        STAGE_ID: 'NEW',
                    },
                }),
            });
            const data = await response.json();
            logger.success('Bitrix24', `Сделка создана, ID: ${data.result}`);
            return { id: data.result, status: 'NEW', created: new Date().toISOString() };
        } catch (err) {
            logger.error('Bitrix24', 'Ошибка создания сделки', err.message);
            throw err;
        }
    }

    /**
     * Обновить статус сделки
     */
    async updateDealStatus(dealId, status) {
        if (this.isDemo) {
            logger.demo('Bitrix24', `Сделка ${dealId} → статус: ${status}`);
            return true;
        }

        try {
            await fetch(`${config.bitrix24.webhookUrl}/crm.deal.update.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: dealId,
                    fields: { STAGE_ID: status },
                }),
            });
            logger.success('Bitrix24', `Сделка ${dealId} обновлена → ${status}`);
            return true;
        } catch (err) {
            logger.error('Bitrix24', 'Ошибка обновления сделки', err.message);
            return false;
        }
    }
}

module.exports = new Bitrix24();
