/**
 * Локальное хранилище лидов + Supabase
 * JSON-файл как fallback, Supabase как основная БД
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { getSupabase } = require('../utils/supabase');

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
     * Сохранить лида в Supabase
     */
    async _saveToSupabase(lead) {
        const sb = getSupabase();
        if (!sb) return;

        try {
            const row = {
                id: lead.id,
                name: lead.name || '',
                phone: lead.phone || '',
                area: lead.area ? parseInt(lead.area) : null,
                floors: lead.floors || '',
                floor_type: lead.floorType || '',
                roof_style: lead.roofStyle || '',
                wall_height: lead.wallHeight || '',
                budget: lead.budget || null,
                location: lead.location || '',
                services: lead.services || [],
                payment_form: lead.paymentForm || '',
                timing: lead.timing || '',
                status: lead.status || 'new',
                pipeline: lead.pipeline || {},
                chat_id: lead.chatId || null,
                temperature: lead.temperature || null,
                created_at: lead.createdAt,
                updated_at: lead.updatedAt,
            };

            const { error } = await sb.from('leads').upsert(row, { onConflict: 'id' });
            if (error) {
                logger.warn('Supabase', 'Ошибка сохранения: ' + error.message);
            } else {
                logger.success('Supabase', 'Лид синхронизирован: ' + lead.name);
            }
        } catch (err) {
            logger.warn('Supabase', 'Ошибка: ' + err.message);
        }
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

        // Async сохранение в Supabase
        this._saveToSupabase(lead).catch(() => { });

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

        // Async сохранение в Supabase
        this._saveToSupabase(this.leads[index]).catch(() => { });

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

        // Async сохранение в Supabase
        this._saveToSupabase(lead).catch(() => { });

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
