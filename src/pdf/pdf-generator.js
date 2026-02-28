/**
 * Генератор PDF коммерческого предложения
 * Использует Puppeteer для конвертации HTML → PDF
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { generateKPTemplate } = require('./templates/kp-template');

class PDFGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '../../data');
        this.browser = null;
    }

    /**
     * Запустить браузер Puppeteer (переиспользуем экземпляр)
     */
    async _getBrowser() {
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }

        const puppeteer = require('puppeteer');
        this.browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
            ],
            timeout: 30000,
        });

        return this.browser;
    }

    /**
     * Генерация PDF файла из данных КП
     */
    async generate(proposal, leadData) {
        const html = generateKPTemplate(proposal, leadData);
        const filename = 'KP_' + leadData.name.replace(/\s/g, '_') + '_' + Date.now() + '.pdf';
        const filepath = path.join(this.outputDir, filename);

        try {
            const browser = await this._getBrowser();
            const page = await browser.newPage();

            await page.setContent(html, {
                waitUntil: 'load',
                timeout: 15000,
            });

            // Ждём загрузки шрифтов
            await new Promise(resolve => setTimeout(resolve, 1000));

            await page.pdf({
                path: filepath,
                format: 'A4',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                preferCSSPageSize: false,
            });

            await page.close();

            const size = fs.statSync(filepath).size;
            logger.success('PDF', 'Файл создан: ' + filename + ' (' + Math.round(size / 1024) + ' КБ)');
            return { filepath, filename, size, isHtml: false };
        } catch (err) {
            logger.warn('PDF', 'Ошибка Puppeteer: ' + err.message);

            // Попытка перезапустить браузер
            try {
                if (this.browser) {
                    await this.browser.close().catch(() => { });
                    this.browser = null;
                }
            } catch (e) {
                // ignore
            }

            // Fallback — сохраняем HTML
            const htmlFilename = filename.replace('.pdf', '.html');
            const htmlPath = path.join(this.outputDir, htmlFilename);
            fs.writeFileSync(htmlPath, html, 'utf8');

            logger.warn('PDF', 'Сохранена HTML-версия: ' + htmlFilename + '. Установите Chromium: npx puppeteer browsers install chrome');
            return { filepath: htmlPath, filename: htmlFilename, size: fs.statSync(htmlPath).size, isHtml: true };
        }
    }
}

module.exports = new PDFGenerator();
