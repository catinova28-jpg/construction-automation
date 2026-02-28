/**
 * AI-агент для генерации текста коммерческого предложения
 * Использует реальные данные по ценам из pricing.js
 */

const config = require('../../config');
const logger = require('../utils/logger');
const { SERVICES } = require('../bot/qualification');
const { calculateEstimate } = require('../data/pricing');

class AIAgent {
    constructor() {
        this.isDemo = !config.hasOpenAI();
        if (this.isDemo) {
            logger.demo('AI-Agent', 'Работа в демо-режиме (нет OPENAI_API_KEY). Используются шаблоны.');
        }
    }

    /**
     * Генерация текста КП на основе реальных цен
     */
    async generateProposal(leadData) {
        // Всегда считаем реальную смету
        const estimate = await calculateEstimate({
            area: leadData.area,
            selectedServices: leadData.services || [],
            location: leadData.location || '',
            floors: leadData.floors || '1',
            floorType: leadData.floorType || 'full',
            roofStyle: leadData.roofStyle || 'gable',
            wallHeight: leadData.wallHeight || '2.5',
            terraceArea: leadData.terraceArea,
        });

        // Формируем proposal для шаблона
        const proposal = {
            greeting: `Уважаемый(ая) ${leadData.name}!`,
            companyIntro: estimate.companyInfo.name + '. ' + estimate.companyInfo.advantages.slice(0, 3).join('. ') + '.',
            companyInfo: estimate.companyInfo,
            params: estimate.params,
            pricePerSqm: estimate.pricePerSqm,
            stages: estimate.stages,
            options: estimate.options,
            stagesTotalPrice: estimate.stagesTotalPrice,
            optionsTotalPrice: estimate.optionsTotalPrice,
            totalCash: estimate.totalCash,
            totalMortgage: estimate.totalMortgage,
            totalCost: estimate.totalCash,
            notes: estimate.notes,
            generatedBy: 'pricing',
        };

        logger.success('AI-Agent', `КП сформировано: ${estimate.totalCash.toLocaleString('ru-RU')} ₽ (${leadData.area} м²)`);
        return proposal;
    }
}

module.exports = new AIAgent();
