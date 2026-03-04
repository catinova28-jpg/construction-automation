/**
 * Интеграция с Битрикс24 CRM
 * Создаёт сделки по данным из Нейроагентов (Авито).
 * В демо-режиме (нет BITRIX24_WEBHOOK_URL) — всё логируется локально.
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
     * Вспомогательный метод: запрос к REST API Битрикс24
     */
    async _call(method, data) {
        const url = `${config.bitrix24.webhookUrl}/${method}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await response.json();
        if (result.error) {
            throw new Error(`Bitrix24 ${method}: ${result.error_description || result.error}`);
        }
        return result;
    }

    /**
     * Создать контакт в CRM (имя + телефон)
     */
    async createContact(leadData) {
        if (this.isDemo) {
            const contactId = `DEMO-C-${Date.now()}`;
            logger.demo('Bitrix24', `Контакт создан ${contactId}: ${leadData.name}`);
            return contactId;
        }

        try {
            // Разделяем имя на части
            var nameParts = (leadData.name || 'Клиент').split(' ');
            var firstName = nameParts[0] || 'Клиент';
            var lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            var fields = {
                NAME: firstName,
                LAST_NAME: lastName,
                SOURCE_ID: 'OTHER',
                SOURCE_DESCRIPTION: 'Авито / Нейроагенты',
            };

            // Добавляем телефон если есть
            if (leadData.phone) {
                fields.PHONE = [{ VALUE: leadData.phone, VALUE_TYPE: 'MOBILE' }];
            }

            var data = await this._call('crm.contact.add.json', {
                fields: fields,
                params: { REGISTER_SONET_EVENT: 'Y' },
            });

            logger.success('Bitrix24', `Контакт создан, ID: ${data.result}`);
            return data.result;
        } catch (err) {
            logger.error('Bitrix24', 'Ошибка создания контакта', err.message);
            return null;
        }
    }

    /**
     * Создать сделку в CRM с полными данными из КП
     * 
     * Ожидаемые поля в leadData:
     *   name, phone, area, floors, location,
     *   serviceNames[], totalCash, kpUrl, estimatedCost
     */
    async createDeal(leadData) {
        if (this.isDemo) {
            const dealId = `DEMO-${Date.now()}`;
            logger.demo('Bitrix24', `Создана сделка ${dealId}`, {
                name: leadData.name,
                area: leadData.area,
                totalCash: leadData.totalCash,
                kpUrl: leadData.kpUrl,
            });
            return {
                id: dealId,
                status: 'PROPOSAL',
                created: new Date().toISOString(),
            };
        }

        // === Реальная интеграция ===
        try {
            // 1. Создаём контакт (если есть имя/телефон)
            var contactId = await this.createContact(leadData);

            // 2. Формируем описание для комментария сделки
            var commentLines = [
                '📐 Площадь: ' + (leadData.area || '?') + ' м²',
                '🏠 Этажность: ' + (leadData.floors || '1'),
                '🔧 Услуги: ' + ((leadData.serviceNames || []).join(', ') || 'стандартный набор'),
                '📍 Адрес: ' + (leadData.location || 'не указан'),
            ];
            if (leadData.kpUrl) {
                commentLines.push('📄 КП: ' + leadData.kpUrl);
            }

            // 3. Стоимость
            var opportunity = leadData.totalCash || leadData.estimatedCost || 0;

            // 4. Создаём сделку
            var dealFields = {
                TITLE: 'ПСК ХОРС — ' + (leadData.name || 'Клиент Авито'),
                STAGE_ID: 'PROPOSAL',
                OPPORTUNITY: opportunity,
                CURRENCY_ID: 'RUB',
                COMMENTS: commentLines.join('\n'),
                SOURCE_ID: 'OTHER',
                SOURCE_DESCRIPTION: 'Авито / Нейроагенты',
            };

            // Привязываем контакт к сделке
            if (contactId) {
                dealFields.CONTACT_ID = contactId;
            }

            var data = await this._call('crm.deal.add.json', {
                fields: dealFields,
                params: { REGISTER_SONET_EVENT: 'Y' },
            });

            var dealId = data.result;
            logger.success('Bitrix24', `Сделка создана, ID: ${dealId}, стадия: КП отправлено`);

            return {
                id: dealId,
                contactId: contactId,
                status: 'PROPOSAL',
                created: new Date().toISOString(),
            };
        } catch (err) {
            logger.error('Bitrix24', 'Ошибка создания сделки', err.message);
            // Не бросаем ошибку — сделка в Б24 не должна блокировать выдачу КП клиенту
            return { id: null, status: 'ERROR', error: err.message };
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
            await this._call('crm.deal.update.json', {
                id: dealId,
                fields: { STAGE_ID: status },
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
