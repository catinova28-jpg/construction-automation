/**
 * Хранилище сгенерированных КП
 * Сохраняет HTML КП и метаданные для отдачи по уникальной ссылке
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const DATA_DIR = path.join(__dirname, '../../data/kp');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

class KPStore {
    constructor() {
        // Создаём папку если нет
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        this._loadIndex();
    }

    _loadIndex() {
        try {
            const data = fs.readFileSync(INDEX_FILE, 'utf8');
            this.index = JSON.parse(data);
        } catch {
            this.index = [];
        }
    }

    _saveIndex() {
        fs.writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2), 'utf8');
    }

    /**
     * Сохранить КП и вернуть уникальный ID
     * @param {string} html - HTML-содержимое КП
     * @param {Object} leadData - Данные клиента
     * @param {Object} proposal - Данные предложения (цены, этапы)
     * @returns {Object} { id, filename, createdAt }
     */
    save(html, leadData, proposal) {
        const id = crypto.randomBytes(8).toString('hex'); // 16-символьный ID
        const filename = `kp_${id}.html`;
        const filepath = path.join(DATA_DIR, filename);

        // Сохраняем HTML
        fs.writeFileSync(filepath, html, 'utf8');

        // Метаданные
        const entry = {
            id,
            filename,
            leadName: leadData.name || 'Клиент',
            leadPhone: leadData.phone || '',
            area: leadData.area || 0,
            totalCash: proposal.totalCash || 0,
            createdAt: new Date().toISOString(),
            views: 0,
            lastViewedAt: null,
        };

        this.index.push(entry);
        this._saveIndex();

        logger.success('KP-Store', `КП сохранено: ${id} для ${entry.leadName}`);
        return entry;
    }

    /**
     * Получить HTML КП по ID
     * @param {string} id
     * @returns {string|null} HTML-содержимое
     */
    getHTML(id) {
        const entry = this.index.find(e => e.id === id);
        if (!entry) return null;

        const filepath = path.join(DATA_DIR, entry.filename);
        if (!fs.existsSync(filepath)) return null;

        // Трекинг просмотра
        entry.views++;
        entry.lastViewedAt = new Date().toISOString();
        this._saveIndex();

        return fs.readFileSync(filepath, 'utf8');
    }

    /**
     * Получить метаданные КП
     */
    getMeta(id) {
        return this.index.find(e => e.id === id) || null;
    }

    /**
     * Все КП
     */
    getAll() {
        return [...this.index].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
}

module.exports = new KPStore();
