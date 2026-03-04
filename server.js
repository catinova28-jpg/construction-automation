/**
 * Точка входа — запуск всех модулей
 */

const config = require('./config');
const logger = require('./src/utils/logger');
const express = require('express');
const path = require('path');
const leadsStore = require('./src/utils/leads-store');
const kpStore = require('./src/utils/kp-store');
const telegramBot = require('./src/bot/telegram-bot');
const pdfGenerator = require('./src/pdf/pdf-generator');
const aiAgent = require('./src/ai/ai-agent');
const { generateKPTemplate } = require('./src/pdf/templates/kp-template');
const { SERVICES, scoreLead, estimateCost } = require('./src/bot/qualification');
const bitrix24 = require('./src/crm/bitrix24');
const notifier = require('./src/notifications/telegram-notifier');

const app = express();
app.use(express.json());

// PDF-каталог — прямая ссылка для скачивания / просмотра
app.get('/catalog.pdf', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'catalog', 'catalog.pdf'));
});

// Каталог домов — быстрая страница, замена медленного Битрикс-каталога
// Маршрут ПЕРЕД static, чтобы не конфликтовал с папкой catalog/
app.get('/catalog', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'catalog.html'));
});

app.use(express.static(path.join(__dirname, 'dashboard')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// ==================== API ====================

// Получить все лиды
app.get('/api/leads', (req, res) => {
    res.json(leadsStore.getAll());
});

// Статистика
app.get('/api/stats', (req, res) => {
    res.json(leadsStore.getStats());
});

// Список услуг
app.get('/api/services', (req, res) => {
    res.json(SERVICES);
});

// Получить конкретного лида
app.get('/api/leads/:id', (req, res) => {
    const lead = leadsStore.get(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Лид не найден' });
    res.json(lead);
});

// ==================== ВЕБ-КП (публичная ссылка) ====================

// Отдать КП по уникальной ссылке (для клиентов)
app.get('/kp/:id', (req, res) => {
    const html = kpStore.getHTML(req.params.id);
    if (!html) {
        return res.status(404).send(`
            <html><body style="font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f8f9ff;">
                <div style="text-align:center;">
                    <h1 style="color:#1a1a2e;">📄 КП не найдено</h1>
                    <p style="color:#666;">Ссылка недействительна или предложение было удалено.</p>
                    <a href="https://domasmplus.ru" style="color:#6366f1;">🌐 Перейти на сайт ПСК «ХОРС»</a>
                </div>
            </body></html>
        `);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});

// API: список всех сгенерированных КП
app.get('/api/kp', (req, res) => {
    res.json(kpStore.getAll());
});

// API: метаданные конкретного КП
app.get('/api/kp/:id', (req, res) => {
    const meta = kpStore.getMeta(req.params.id);
    if (!meta) return res.status(404).json({ error: 'КП не найдено' });
    res.json(meta);
});

// ==================== BITRIX24 WEBHOOK ====================

/**
 * Эндпоинт для робота Битрикс24
 * Когда НейроЭйдженс квалифицирует клиента → данные попадают в Б24 → робот вызывает этот webhook
 * 
 * Ожидаемые поля в body:
 *   name, phone, area, budget, location, timing,
 *   floors, floorType, roofStyle, wallHeight,
 *   services (массив или строка через запятую),
 *   dealId (ID сделки в Б24)
 */
app.post('/api/bitrix/lead', async (req, res) => {
    try {
        const body = req.body;
        logger.info('Bitrix-Webhook', `Получен лид: ${body.name || 'Без имени'}, ${body.area || '?'} м²`);

        // Нормализуем данные
        const leadData = {
            name: body.name || 'Клиент',
            phone: body.phone || '',
            area: parseInt(body.area) || 100,
            budget: parseInt(String(body.budget || '0').replace(/\s/g, '')) || 0,
            location: body.location || '',
            timing: body.timing || 'thinking',
            paymentForm: body.paymentForm || 'cash',
            floors: body.floors || '1',
            floorType: body.floorType || 'full',
            roofStyle: body.roofStyle || 'gable',
            wallHeight: body.wallHeight || '2.5',
            services: Array.isArray(body.services)
                ? body.services
                : (body.services || 'foundation,sip_box,roof').split(',').map(s => s.trim()),
            dealId: body.dealId || null,
            source: 'bitrix24',
        };

        // Скоринг
        const score = scoreLead(leadData);
        const cost = estimateCost(leadData);
        leadData.estimatedCost = cost;
        leadData.score = score.score;
        leadData.temperature = score.temperature;
        leadData.temperatureLabel = score.label;
        leadData.category = score.category;
        leadData.serviceNames = leadData.services.map(id => {
            const s = SERVICES.find(srv => srv.id === id);
            return s ? s.name : id;
        });

        // 1. Сохраняем лида
        const lead = leadsStore.add(leadData);
        if (leadData.dealId) {
            leadsStore.update(lead.id, { dealId: leadData.dealId });
        }
        leadsStore.updatePipeline(lead.id, 'crmCreated');

        // 2. Генерируем КП
        const proposal = await aiAgent.generateProposal(leadData);
        const html = generateKPTemplate(proposal, leadData);

        // 3. Сохраняем веб-КП
        const kpEntry = kpStore.save(html, leadData, proposal);
        const baseUrl = body.baseUrl || req.protocol + '://' + req.get('host');
        const kpUrl = baseUrl + '/kp/' + kpEntry.id;

        // 4. Также генерируем PDF (на всякий случай)
        const pdf = await pdfGenerator.generate(proposal, leadData);
        leadsStore.updatePipeline(lead.id, 'kpGenerated');
        leadsStore.update(lead.id, { pdfFile: pdf.filename, kpId: kpEntry.id, kpUrl });

        logger.success('Bitrix-Webhook', `КП готово: ${kpUrl}`);

        // Уведомляем менеджера
        await notifier.notifyKPSent({ ...leadData, totalCash: proposal.totalCash, estimatedCost: cost }, kpUrl);

        // Возвращаем ссылку на КП — робот Б24 может передать её обратно ИИ-продавцу
        res.json({
            success: true,
            kpUrl,
            kpId: kpEntry.id,
            leadId: lead.id,
            totalCash: proposal.totalCash,
            totalMortgage: proposal.totalMortgage,
        });
    } catch (err) {
        logger.error('Bitrix-Webhook', 'Ошибка обработки лида', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==================== NEUROAGENTS API ====================

/**
 * Эндпоинт для инструмента Нейроагентов (generate_kp)
 * ИИ-продавец Дмитрий вызывает этот endpoint через HTTP-инструмент,
 * передавая параметры, собранные в диалоге с клиентом на Авито.
 *
 * Входные параметры ($input из Нейроагентов):
 *   name     — имя клиента
 *   phone    — телефон клиента
 *   area     — площадь дома (м²)
 *   floors   — этажность (1, 1.5, 2)
 *   roofStyle — тип крыши (gable/hip/flat)
 *   location — город/район
 *   services — услуги (строка через запятую)
 *
 * Ответ — текст, который ИИ-продавец передаёт клиенту:
 *   kpUrl, totalCash, totalMortgage
 */
app.post('/api/neuroagents/generate-kp', async (req, res) => {
    try {
        const body = req.body;
        logger.info('Neuroagents', `Получен запрос КП: ${body.name || 'Без имени'}, ${body.area || '?'} м²`);

        // Нормализуем данные из диалога
        const areaNum = parseInt(String(body.area || '100').replace(/[^\d]/g, '')) || 100;

        // Определяем этажность
        let floors = '1';
        let floorType = 'full';
        const floorsRaw = String(body.floors || '1').trim();
        if (floorsRaw.includes('1.5') || floorsRaw.includes('полтора') || floorsRaw.includes('мансард')) {
            floors = '1.5';
            floorType = 'mansard';
        } else if (floorsRaw.includes('2') || floorsRaw.includes('два') || floorsRaw.includes('двух')) {
            floors = '2';
            floorType = 'full';
        }

        // Определяем тип крыши
        let roofStyle = 'gable';
        const roofRaw = String(body.roofStyle || 'двускатная').toLowerCase();
        if (roofRaw.includes('hip') || roofRaw.includes('четырёх') || roofRaw.includes('четырех') || roofRaw.includes('вальм')) {
            roofStyle = 'hip';
        } else if (roofRaw.includes('flat') || roofRaw.includes('плоск')) {
            roofStyle = 'flat';
        }

        // Парсим услуги
        const defaultServices = 'foundation,sip_box,roof,facade,windows,engineering';
        let services;
        if (Array.isArray(body.services)) {
            services = body.services;
        } else {
            const svcRaw = String(body.services || defaultServices);
            services = svcRaw.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Собираем данные лида
        const leadData = {
            name: body.name || 'Клиент Авито',
            phone: body.phone || '',
            area: areaNum,
            budget: 0,
            location: body.location || '',
            timing: 'soon',
            paymentForm: 'cash',
            floors,
            floorType,
            roofStyle,
            wallHeight: floors === '1' ? '2.8' : '2.5',
            services,
            source: 'neuroagents-avito',
        };

        // Скоринг
        const score = scoreLead(leadData);
        const cost = estimateCost(leadData);
        leadData.estimatedCost = cost;
        leadData.score = score.score;
        leadData.temperature = score.temperature;
        leadData.temperatureLabel = score.label;
        leadData.category = score.category;
        leadData.serviceNames = leadData.services.map(id => {
            const s = SERVICES.find(srv => srv.id === id);
            return s ? s.name : id;
        });

        // 1. Сохраняем лида
        const lead = leadsStore.add(leadData);
        leadsStore.updatePipeline(lead.id, 'crmCreated');

        // 2. Генерируем КП
        const proposal = await aiAgent.generateProposal(leadData);
        const html = generateKPTemplate(proposal, leadData);

        // 3. Сохраняем веб-КП
        const kpEntry = kpStore.save(html, leadData, proposal);
        const baseUrl = body.baseUrl || req.protocol + '://' + req.get('host');
        const kpUrl = baseUrl + '/kp/' + kpEntry.id;

        // 4. Генерируем PDF
        const pdf = await pdfGenerator.generate(proposal, leadData);
        leadsStore.updatePipeline(lead.id, 'kpGenerated');
        leadsStore.update(lead.id, { pdfFile: pdf.filename, kpId: kpEntry.id, kpUrl });

        logger.success('Neuroagents', `КП готово: ${kpUrl}`);

        // Формат ответа для ИИ-продавца
        // ИИ получит эти данные и передаст клиенту в чат Авито
        const totalCash = proposal.totalCash || cost;
        const totalMortgage = proposal.totalMortgage || Math.round(cost * 1.15);

        // 5. Создаём сделку в Битрикс24 (если настроен webhook)
        let dealResult = null;
        try {
            const dealData = { ...leadData, totalCash, kpUrl };
            dealResult = await bitrix24.createDeal(dealData);
            if (dealResult && dealResult.id) {
                leadsStore.update(lead.id, { dealId: dealResult.id });
                leadsStore.updatePipeline(lead.id, 'crmCreated');
                logger.success('Neuroagents', `Сделка в Б24: ${dealResult.id}`);
            }
        } catch (bitrixErr) {
            logger.error('Neuroagents', 'Ошибка Битрикс24 (не критичная)', bitrixErr.message);
        }

        // 6. Уведомляем менеджера в Telegram
        await notifier.notifyKPSent({ ...leadData, totalCash }, kpUrl);

        res.json({
            success: true,
            kpUrl,
            kpId: kpEntry.id,
            leadId: lead.id,
            area: areaNum,
            floors,
            totalCash,
            totalMortgage,
            message: `КП для ${leadData.name} готово. Ссылка: ${kpUrl}. Стоимость: от ${totalCash.toLocaleString('ru-RU')} руб. (наличные) / ${totalMortgage.toLocaleString('ru-RU')} руб. (ипотека).`,
        });
    } catch (err) {
        logger.error('Neuroagents', 'Ошибка генерации КП', err.message);
        res.status(500).json({ error: 'Не удалось сгенерировать КП: ' + err.message });
    }
});

// ==================== NOTIFY MANAGER API ====================

/**
 * Эндпоинт для ИИ-продавца: уведомить менеджера
 * Типы:
 *   callback_request — клиент хочет созвониться
 *   custom_request   — индивидуальный запрос
 */
app.post('/api/neuroagents/notify-manager', async (req, res) => {
    try {
        const body = req.body;
        const type = body.type || 'custom_request';

        const data = {
            name: body.name || 'Клиент',
            phone: body.phone || '',
            context: body.context || body.message || '',
            source: body.source || 'neuroagents-avito',
        };

        logger.info('Notify', `Запрос уведомления: ${type} от ${data.name}`);

        if (type === 'callback_request') {
            await notifier.notifyCallbackRequest(data);
        } else {
            await notifier.notifyCustomRequest(data);
        }

        res.json({ success: true, message: 'Уведомление отправлено менеджеру' });
    } catch (err) {
        logger.error('Notify', 'Ошибка уведомления', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==================== DEMO API ====================

// Симуляция отправки сообщения боту
app.post('/api/demo/message', async (req, res) => {
    try {
        const { chatId, text } = req.body;
        const id = chatId || `demo-${Date.now()}`;
        const result = await telegramBot.simulateMessage(id, text);
        res.json({ chatId: id, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Симуляция нажатия кнопки
app.post('/api/demo/callback', async (req, res) => {
    try {
        const { chatId, data } = req.body;
        const result = await telegramBot.simulateCallback(chatId, data);
        res.json({ chatId, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Быстрое создание тестового лида через API
app.post('/api/demo/test-lead', async (req, res) => {
    try {
        const testData = {
            chatId: `demo-${Date.now()}`,
            name: req.body.name || 'Тестовый Клиент',
            services: req.body.services || ['foundation', 'sip_box', 'roof', 'facade', 'windows', 'terrace', 'engineering', 'drywall'],
            area: req.body.area || 120,
            budget: req.body.budget || 4500000,
            location: req.body.location || 'Московская область',
            phone: req.body.phone || '+7 (999) 123-45-67',
            paymentForm: req.body.paymentForm || 'cash',
            timing: req.body.timing || 'soon',
            floors: req.body.floors || '1',
            floorType: req.body.floorType || 'full',
            roofStyle: req.body.roofStyle || 'gable',
            wallHeight: req.body.wallHeight || '2.5',
        };

        const score = scoreLead(testData);
        const cost = estimateCost(testData);
        testData.estimatedCost = cost;
        testData.score = score.score;
        testData.temperature = score.temperature;
        testData.temperatureLabel = score.label;
        testData.category = score.category;
        testData.serviceNames = testData.services.map(id => {
            const s = SERVICES.find(srv => srv.id === id);
            return s ? s.name : id;
        });

        // Сохраняем лида
        const lead = leadsStore.add(testData);
        leadsStore.updatePipeline(lead.id, 'crmCreated');

        logger.step(1, 4, `Тестовый лид создан: ${lead.id}`);

        // Генерируем КП
        const proposal = await aiAgent.generateProposal(testData);
        logger.step(2, 5, 'КП сгенерировано');

        // Сохраняем веб-КП
        const kpHtml = generateKPTemplate(proposal, testData);
        const kpEntry = kpStore.save(kpHtml, testData, proposal);
        const kpUrl = req.protocol + '://' + req.get('host') + '/kp/' + kpEntry.id;
        logger.step(3, 5, `Веб-КП: ${kpUrl}`);

        const pdf = await pdfGenerator.generate(proposal, testData);
        leadsStore.updatePipeline(lead.id, 'kpGenerated');
        leadsStore.update(lead.id, { pdfFile: pdf.filename, kpId: kpEntry.id, kpUrl });
        logger.step(4, 5, `PDF создан: ${pdf.filename}`);

        leadsStore.updatePipeline(lead.id, 'videoSent');
        leadsStore.updatePipeline(lead.id, 'kpSent');
        logger.step(5, 5, 'Конвейер завершён');

        res.json({
            success: true,
            lead: leadsStore.get(lead.id),
            kpUrl,
            pdf: { filename: pdf.filename, isHtml: pdf.isHtml || false },
        });
    } catch (err) {
        logger.error('API', 'Ошибка создания тестового лида', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==================== STARTUP ====================

async function start() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║    🏗️  ПСК «ХОРС» — Система автоматизации КП        ║');
    console.log('║    Генерация коммерческих предложений                ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');

    if (config.isDemo()) {
        logger.demo('System', '══════════════════════════════════════');
        logger.demo('System', '  ДЕМО РЕЖИМ — без реальных API');
        logger.demo('System', '══════════════════════════════════════');
        console.log('');
    }

    // Запускаем Telegram бота
    await telegramBot.init();

    // Запускаем уведомления (используем бота для отправки)
    notifier.init(telegramBot.bot);

    // Запускаем Express сервер
    app.listen(config.port, () => {
        logger.success('Server', `Дашборд запущен: http://localhost:${config.port}`);
        logger.success('Server', `API: http://localhost:${config.port}/api/leads`);
        console.log('');
        logger.info('Server', '📋 Доступные API эндпоинты:');
        logger.info('Server', '  GET  /api/leads           — все лиды');
        logger.info('Server', '  GET  /api/stats           — статистика');
        logger.info('Server', '  GET  /api/services        — список услуг');
        logger.info('Server', '  GET  /api/kp              — все КП');
        logger.info('Server', '  GET  /kp/:id              — 🌐 веб-КП для клиента');
        logger.info('Server', '  POST /api/bitrix/lead      — ⚡ webhook из Битрикс24');
        logger.info('Server', '  POST /api/demo/test-lead   — создать тестовый лид + КП');
        console.log('');

        if (config.isDemo()) {
            logger.info('Server', '💡 Попробуйте: curl -X POST http://localhost:3000/api/demo/test-lead');
            logger.info('Server', '💡 Или webhook: curl -X POST http://localhost:3000/api/bitrix/lead -H "Content-Type: application/json" -d \'{"name":"Иван","area":120,"location":"Краснодар"}\'');
        }
    });
}

start().catch(err => {
    logger.error('System', 'Критическая ошибка запуска', err);
    process.exit(1);
});
