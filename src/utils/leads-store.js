/**
 * Локальное хранилище лидов
 * Сохраняет в JSON-файл для простоты (MVP)
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const DATA_FILE = path.join(__dirname, '../../data/leads.json');

class LeadsStore {
    constructor() {
        this._load();
    }

    _load() {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            this.leads = JSON.parse(data);
        } catch {
            this.leads = [];
        }
    }

    _save() {
        fs.writeFileSync(DATA_FILE, JSON.stringify(this.leads, null, 2), 'utf8');
    }

    /**
     * Добавить нового лида
     */
    add(leadData) {
        const lead = {
            id: uuidv4(),
            ...leadData,
            status: 'new',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pipeline: {
                qualified: true,
                crmCreated: false,
                videoSent: false,
                kpGenerated: false,
                kpSent: false,
            },
        };
        this.leads.push(lead);
        this._save();
        logger.success('Store', `Лид сохранён: ${lead.id} (${lead.name})`);
        return lead;
    }

    /**
     * Обновить лида
     */
    update(leadId, updates) {
        const index = this.leads.findIndex(l => l.id === leadId);
        if (index === -1) return null;

        this.leads[index] = {
            ...this.leads[index],
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this._save();
        return this.leads[index];
    }

    /**
     * Обновить этап воронки
     */
    updatePipeline(leadId, stage, value = true) {
        const lead = this.get(leadId);
        if (!lead) return null;

        lead.pipeline[stage] = value;
        lead.updatedAt = new Date().toISOString();

        // Обновить статус
        if (lead.pipeline.kpSent) lead.status = 'kp_sent';
        else if (lead.pipeline.kpGenerated) lead.status = 'kp_ready';
        else if (lead.pipeline.videoSent) lead.status = 'video_sent';
        else if (lead.pipeline.crmCreated) lead.status = 'in_crm';
        else lead.status = 'new';

        this._save();
        return lead;
    }

    /**
     * Получить лида по ID
     */
    get(leadId) {
        return this.leads.find(l => l.id === leadId) || null;
    }

    /**
     * Все лиды
     */
    getAll() {
        return [...this.leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Статистика для дашборда
     */
    getStats() {
        const total = this.leads.length;
        const byStatus = {
            new: this.leads.filter(l => l.status === 'new').length,
            in_crm: this.leads.filter(l => l.status === 'in_crm').length,
            video_sent: this.leads.filter(l => l.status === 'video_sent').length,
            kp_ready: this.leads.filter(l => l.status === 'kp_ready').length,
            kp_sent: this.leads.filter(l => l.status === 'kp_sent').length,
        };
        const byTemperature = {
            hot: this.leads.filter(l => l.temperature === 'hot').length,
            warm: this.leads.filter(l => l.temperature === 'warm').length,
            cold: this.leads.filter(l => l.temperature === 'cold').length,
        };
        return { total, byStatus, byTemperature };
    }
}

module.exports = new LeadsStore();
