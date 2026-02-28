/**
 * Telegram-бот с FSM-диалогом для квалификации лидов
 * В демо-режиме — симуляция через REST API
 */

const config = require('../../config');
const logger = require('../utils/logger');
const { SERVICES, STATES, FLOOR_OPTIONS, FLOOR_TYPE_OPTIONS, ROOF_STYLE_OPTIONS, WALL_HEIGHT_OPTIONS, PAYMENT_OPTIONS, TIMING_OPTIONS, scoreLead, estimateCost } = require('./qualification');
const leadsStore = require('../utils/leads-store');
const bitrix24 = require('../crm/bitrix24');
const scheduler = require('../scheduler/timer');
const aiAgent = require('../ai/ai-agent');
const pdfGenerator = require('../pdf/pdf-generator');
const videoSender = require('../video/video-sender');
const { getHouseImagePath, getHouseCaption } = require('../utils/house-image');

class TelegramBot {
    constructor() {
        this.sessions = new Map(); // chatId → session state
        this.bot = null;
        this._processedCallbacks = new Set(); // защита от дублей callback
    }

    /**
     * Инициализация бота
     */
    async init() {
        if (config.hasTelegram()) {
            try {
                const TelegramBotAPI = require('node-telegram-bot-api');
                this.bot = new TelegramBotAPI(config.telegram.token, { polling: true });
                this._setupHandlers();
                logger.success('TelegramBot', 'Бот запущен в режиме polling');
            } catch (err) {
                logger.error('TelegramBot', 'Ошибка запуска бота', err.message);
            }
        } else {
            logger.demo('TelegramBot', 'Бот работает в демо-режиме (без Telegram API)');
            logger.demo('TelegramBot', 'Используйте API: POST /api/demo/message для симуляции диалога');
        }

        // Настраиваем планировщик
        scheduler.setHandler(async (leadId, leadData) => {
            await this._processLeadPipeline(leadId, leadData);
        });
    }

    /**
     * Настройка обработчиков Telegram
     */
    _setupHandlers() {
        this.bot.onText(/\/start/, (msg) => this._handleStart(msg.chat.id, msg.from.first_name));
        this.bot.onText(/\/test/, (msg) => this._handleTestLead(msg.chat.id));
        this.bot.on('callback_query', (query) => this._handleCallback(query));
        this.bot.on('message', (msg) => {
            if (msg.text && !msg.text.startsWith('/')) {
                this._handleMessage(msg.chat.id, msg.text);
            }
        });
    }

    /**
     * /start — начало квалификации
     */
    async _handleStart(chatId, firstName) {
        this.sessions.set(chatId, {
            state: STATES.NAME,
            data: { chatId, telegramName: firstName },
        });

        const welcome = `🏠 *Добро пожаловать в ПСК «ХОРС»!*

Мы строим современные энергоэффективные дома из СИП панелей.
🌐 Наш сайт: domasmplus.ru

Давайте подберём для вас оптимальное решение! Для начала, как к вам обращаться?

_Введите ваше имя:_`;

        await this._send(chatId, welcome, { parse_mode: 'Markdown' });
        logger.info('Bot', `Новый диалог: chatId=${chatId}, name=${firstName}`);
    }

    /**
     * Обработка текстовых сообщений (FSM)
     */
    async _handleMessage(chatId, text) {
        const session = this.sessions.get(chatId);
        if (!session) {
            return this._handleStart(chatId, 'Гость');
        }

        switch (session.state) {
            case STATES.NAME:
                session.data.name = text.trim();
                session.state = STATES.SERVICE;
                await this._sendServiceSelection(chatId, session.data.name);
                break;

            case STATES.AREA:
                const area = parseInt(text);
                if (isNaN(area) || area < 10 || area > 2000) {
                    await this._send(chatId, '⚠️ Пожалуйста, введите площадь в м² (от 10 до 2000):');
                    return;
                }
                session.data.area = area;
                session.state = STATES.FLOORS;
                await this._sendFloorsSelection(chatId, area);
                break;

            case STATES.BUDGET:
                const budget = parseInt(text.replace(/\s/g, ''));
                if (isNaN(budget) || budget < 100000) {
                    await this._send(chatId, '⚠️ Введите бюджет в рублях (число, минимум 100 000):');
                    return;
                }
                session.data.budget = budget;
                session.state = STATES.LOCATION;
                await this._send(chatId, `💰 Бюджет: *${budget.toLocaleString('ru-RU')} ₽*\n\n📍 Укажите адрес или район строительства:`, { parse_mode: 'Markdown' });
                break;

            case STATES.LOCATION:
                session.data.location = text.trim();
                session.state = STATES.PHONE;
                await this._send(chatId, `📍 Адрес: *${session.data.location}*\n\n📱 Оставьте ваш номер телефона для связи:`, { parse_mode: 'Markdown' });
                break;

            case STATES.PHONE:
                const digits = text.replace(/\D/g, '');
                if (digits.length !== 11) {
                    await this._send(chatId, '⚠️ Номер телефона должен содержать 11 цифр (например: 89881234567). Попробуйте ещё раз:');
                    return;
                }
                session.data.phone = text.trim();
                session.state = STATES.PAYMENT;
                await this._sendPaymentSelection(chatId);
                break;

            default:
                await this._send(chatId, 'Введите /start чтобы начать заново.');
        }

        this.sessions.set(chatId, session);
    }

    /**
     * Отправить меню выбора услуг
     */
    async _sendServiceSelection(chatId, name) {
        const session = this.sessions.get(chatId);
        if (session) session.data.services = [];

        const keyboard = SERVICES.map(s => ([{
            text: `${s.icon} ${s.name}`,
            callback_data: `svc_${s.id}`,
        }]));

        keyboard.push([{
            text: '🟢 ГОТОВО — перейти к параметрам ▶️',
            callback_data: 'svc_done',
        }]);

        await this._send(chatId, `Приятно познакомиться, *${name}*! 🤝\n\nВыберите нужные услуги (можно несколько), затем нажмите *ГОТОВО* ⬇️`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Обработка нажатий inline-кнопок
     */
    async _handleCallback(query) {
        const chatId = query.message.chat.id;
        const data = query.data;
        const session = this.sessions.get(chatId);

        if (!session) return;

        // Защита от дублирования callback в polling-режиме
        const callbackKey = `${query.id}_${data}`;
        if (query.id !== 'demo' && this._processedCallbacks.has(callbackKey)) return;
        this._processedCallbacks.add(callbackKey);
        // Очищаем старые записи (хранить не более 100)
        if (this._processedCallbacks.size > 100) {
            const first = this._processedCallbacks.values().next().value;
            this._processedCallbacks.delete(first);
        }

        if (data.startsWith('svc_')) {
            const serviceId = data.replace('svc_', '');

            if (serviceId === 'done') {
                if (!session.data.services || session.data.services.length === 0) {
                    await this._answerCallback(query.id, '⚠️ Выберите хотя бы одну услугу');
                    return;
                }
                session.state = STATES.AREA;
                const selected = session.data.services.map(id => {
                    const s = SERVICES.find(srv => srv.id === id);
                    return s ? `${s.icon} ${s.name}` : id;
                }).join('\n');

                await this._send(chatId, `Выбраны услуги:\n${selected}\n\n📐 Укажите площадь дома/объекта в м²:`, { parse_mode: 'Markdown' });
            } else {
                if (!session.data.services) session.data.services = [];
                const idx = session.data.services.indexOf(serviceId);
                if (idx === -1) {
                    session.data.services.push(serviceId);
                    await this._answerCallback(query.id, `✅ Добавлено: ${SERVICES.find(s => s.id === serviceId)?.name}`);
                } else {
                    session.data.services.splice(idx, 1);
                    await this._answerCallback(query.id, `❌ Убрано: ${SERVICES.find(s => s.id === serviceId)?.name}`);
                }
            }
        } else if (data.startsWith('floors_')) {
            const floorsId = data.replace('floors_', '');
            session.data.floors = floorsId;
            const selected = FLOOR_OPTIONS.find(f => f.id === floorsId);
            await this._answerCallback(query.id, `${selected.icon} ${selected.name}`);
            if (floorsId === '2') {
                session.state = STATES.FLOOR_TYPE;
                await this._sendFloorTypeSelection(chatId);
            } else {
                session.state = STATES.ROOF_STYLE;
                await this._sendRoofStyleSelection(chatId);
            }
        } else if (data.startsWith('floortype_')) {
            const typeId = data.replace('floortype_', '');
            session.data.floorType = typeId;
            const selected = FLOOR_TYPE_OPTIONS.find(f => f.id === typeId);
            await this._answerCallback(query.id, `${selected.icon} ${selected.name}`);
            session.state = STATES.ROOF_STYLE;
            await this._sendRoofStyleSelection(chatId);
        } else if (data.startsWith('roof_')) {
            const roofId = data.replace('roof_', '');
            session.data.roofStyle = roofId;
            const selected = ROOF_STYLE_OPTIONS.find(r => r.id === roofId);
            await this._answerCallback(query.id, `${selected.icon} ${selected.name}`);
            // Хай-тек всегда с полноценным 2-м этажом (мансарды не бывает)
            if (roofId === 'hitech' && session.data.floorType === 'mansard') {
                session.data.floorType = 'full';
                logger.info('Bot', 'Хай-тек: floorType принудительно изменён на full');
            }
            // Для мансарды (только классика) пропускаем выбор высоты
            if (session.data.floorType === 'mansard') {
                session.data.wallHeight = '2.5';
                session.state = STATES.BUDGET;
                await this._send(chatId, '💰 Какой у вас примерный бюджет? (в рублях, например: 3000000)');
            } else {
                session.state = STATES.WALL_HEIGHT;
                await this._sendWallHeightSelection(chatId);
            }
        } else if (data.startsWith('wallh_')) {
            const heightId = data.replace('wallh_', '');
            session.data.wallHeight = heightId;
            const selected = WALL_HEIGHT_OPTIONS.find(h => h.id === heightId);
            await this._answerCallback(query.id, `${selected.icon} ${selected.name}`);
            session.state = STATES.BUDGET;
            await this._send(chatId, '💰 Какой у вас примерный бюджет? (в рублях, например: 3000000)');
        } else if (data.startsWith('pay_')) {
            const paymentId = data.replace('pay_', '');
            session.data.paymentForm = paymentId;
            const selected = PAYMENT_OPTIONS.find(p => p.id === paymentId);
            await this._answerCallback(query.id, `${selected.icon} ${selected.name}`);
            session.state = STATES.TIMING;
            await this._sendTimingSelection(chatId);
        } else if (data.startsWith('timing_')) {
            const timingId = data.replace('timing_', '');
            session.data.timing = timingId;
            const selected = TIMING_OPTIONS.find(t => t.id === timingId);
            await this._answerCallback(query.id, `${selected.icon} ${selected.name}`);
            session.state = STATES.CONFIRM;
            await this._sendConfirmation(chatId, session.data);
        } else if (data === 'confirm_yes') {
            await this._processConfirmedLead(chatId, session.data);
        } else if (data === 'confirm_no') {
            session.state = STATES.NAME;
            session.data = { chatId };
            await this._send(chatId, 'Хорошо, начнём заново! Как вас зовут?');
        }

        this.sessions.set(chatId, session);
    }

    /**
     * Показать выбор этажности
     */
    async _sendFloorsSelection(chatId, area) {
        const keyboard = FLOOR_OPTIONS.map(f => ([{
            text: `${f.icon} ${f.name}`,
            callback_data: `floors_${f.id}`,
        }]));

        await this._send(chatId, `📐 Площадь: *${area} м²*\n\n🏠 *Сколько этажей?*`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Показать выбор типа 2-го этажа
     */
    async _sendFloorTypeSelection(chatId) {
        const keyboard = FLOOR_TYPE_OPTIONS.map(f => ([{
            text: `${f.icon} ${f.name}`,
            callback_data: `floortype_${f.id}`,
        }]));

        await this._send(chatId, '🏢 *Какой тип 2-го этажа?*', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Показать выбор стиля кровли
     */
    async _sendRoofStyleSelection(chatId) {
        const keyboard = ROOF_STYLE_OPTIONS.map(r => ([{
            text: `${r.icon} ${r.name}`,
            callback_data: `roof_${r.id}`,
        }]));

        await this._send(chatId, '🏠 *Какой стиль кровли?*', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Показать выбор высоты стен
     */
    async _sendWallHeightSelection(chatId) {
        const keyboard = WALL_HEIGHT_OPTIONS.map(h => ([{
            text: `${h.icon} ${h.name}`,
            callback_data: `wallh_${h.id}`,
        }]));

        await this._send(chatId, '📏 *Какая высота стен?*', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Показать выбор формы оплаты
     */
    async _sendPaymentSelection(chatId) {
        const keyboard = PAYMENT_OPTIONS.map(p => ([{
            text: `${p.icon} ${p.name}`,
            callback_data: `pay_${p.id}`,
        }]));

        await this._send(chatId, '💳 *Какая форма оплаты?*', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Показать выбор сроков строительства
     */
    async _sendTimingSelection(chatId) {
        const keyboard = TIMING_OPTIONS.map(t => ([{
            text: `${t.icon} ${t.name}`,
            callback_data: `timing_${t.id}`,
        }]));

        await this._send(chatId, '🗓️ *Когда планируете приступить к строительству?*', {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard },
        });
    }

    /**
     * Показать подтверждение (без цены и степени горячести — клиенту не нужно)
     */
    async _sendConfirmation(chatId, data) {
        const serviceNames = (data.services || []).map(id => {
            const s = SERVICES.find(srv => srv.id === id);
            return s ? `${s.icon} ${s.name}` : id;
        }).join('\n  ');

        const paymentLabel = PAYMENT_OPTIONS.find(p => p.id === data.paymentForm);
        const timingLabel = TIMING_OPTIONS.find(t => t.id === data.timing);
        const floorsLabel = FLOOR_OPTIONS.find(f => f.id === data.floors);
        const roofLabel = ROOF_STYLE_OPTIONS.find(r => r.id === data.roofStyle);
        const wallHLabel = WALL_HEIGHT_OPTIONS.find(h => h.id === data.wallHeight);
        const floorTypeLabel = data.floors === '2' ? FLOOR_TYPE_OPTIONS.find(f => f.id === data.floorType) : null;

        let houseDesc = floorsLabel ? floorsLabel.name : '';
        if (floorTypeLabel) houseDesc += ` (${floorTypeLabel.name})`;

        const msg = `📋 *Проверьте данные:*

👤 Имя: ${data.name}
🏗️ Услуги:
  ${serviceNames}
📐 Площадь: ${data.area} м²
🏠 Дом: ${houseDesc}
🏠 Кровля: ${roofLabel ? roofLabel.name : data.roofStyle}
📏 Высота стен: ${wallHLabel ? wallHLabel.name : data.wallHeight + ' м'}
💰 Бюджет: ${data.budget.toLocaleString('ru-RU')} ₽
📍 Адрес: ${data.location}
📱 Телефон: ${data.phone}
💳 Оплата: ${paymentLabel ? paymentLabel.icon + ' ' + paymentLabel.name : data.paymentForm}
🗓️ Сроки: ${timingLabel ? timingLabel.icon + ' ' + timingLabel.name : data.timing}

_Всё верно?_`;

        await this._send(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Да, всё верно', callback_data: 'confirm_yes' },
                        { text: '🔄 Начать заново', callback_data: 'confirm_no' },
                    ],
                ],
            },
        });
    }

    /**
     * Обработка подтверждённого лида
     */
    async _processConfirmedLead(chatId, data) {
        const score = scoreLead(data);
        const cost = estimateCost(data);

        data.estimatedCost = cost;
        data.score = score.score;
        data.temperature = score.temperature;
        data.category = score.category;
        data.temperatureLabel = score.label;
        data.serviceNames = (data.services || []).map(id => {
            const s = SERVICES.find(srv => srv.id === id);
            return s ? s.name : id;
        });

        // 1. Сохраняем лида
        const lead = leadsStore.add(data);
        logger.step(1, 6, 'Лид сохранён в базу');

        await this._send(chatId, `✅ Отлично! Ваша заявка принята!\n\n📄 Формируем для вас персональное коммерческое предложение...\n\nСпасибо за доверие, *${data.name}*! 🙏`, { parse_mode: 'Markdown' });

        // 2. Создаём сделку в CRM
        try {
            const deal = await bitrix24.createDeal(data);
            leadsStore.update(lead.id, { dealId: deal.id });
            leadsStore.updatePipeline(lead.id, 'crmCreated');
            logger.step(2, 6, `Сделка создана в CRM: ${deal.id}`);
        } catch (err) {
            logger.error('Bot', 'Ошибка CRM', err.message);
        }

        // 3. Планируем таймер (10 сек в демо / 1 час в проде)
        const delay = config.isDemo() ? 10000 : 3600000;
        scheduler.schedule(lead.id, { ...data, leadId: lead.id, chatId }, delay);
        logger.step(3, 6, `Таймер установлен: ${config.isDemo() ? '10 сек' : '1 час'}`);

        this.sessions.delete(chatId);
    }

    /**
     * Обработка конвейера после таймера
     */
    async _processLeadPipeline(leadId, leadData) {
        logger.info('Pipeline', `🚀 Запуск конвейера для лида ${leadId}`);

        // 4. Отправляем видео
        await videoSender.send(leadData.chatId, this.bot);
        leadsStore.updatePipeline(leadId, 'videoSent');
        logger.step(4, 7, 'Видео отправлены');

        // 5. Отправляем фото дома
        await this._sendHouseImage(leadData.chatId, leadData);
        logger.step(5, 7, 'Фото дома отправлено');

        // 6. Генерируем КП через AI агент
        const proposal = await aiAgent.generateProposal(leadData);
        logger.step(6, 7, 'КП сгенерировано AI-агентом');

        // 7. Генерируем PDF
        const pdf = await pdfGenerator.generate(proposal, leadData);
        leadsStore.updatePipeline(leadId, 'kpGenerated');
        leadsStore.update(leadId, { pdfFile: pdf.filename });
        logger.step(7, 7, `PDF создан: ${pdf.filename}`);

        // 7. Отправляем PDF клиенту
        if (this.bot && leadData.chatId) {
            try {
                if (pdf.isHtml) {
                    await this.bot.sendDocument(leadData.chatId, pdf.filepath, {
                        caption: '📄 Ваше персональное коммерческое предложение',
                    });
                } else {
                    await this.bot.sendDocument(leadData.chatId, pdf.filepath, {
                        caption: '📄 Ваше персональное коммерческое предложение в формате PDF',
                    });
                }
                leadsStore.updatePipeline(leadId, 'kpSent');
                logger.success('Pipeline', `КП отправлено клиенту ${leadData.name}`);

                // Сообщение после отправки КП
                await this.bot.sendMessage(leadData.chatId,
                    `${leadData.name}, будем ждать вашу обратную связь! 🙏\n\nЕсли возникнут вопросы по коммерческому предложению — пишите прямо сюда, мы на связи. 💬`
                );
            } catch (err) {
                logger.error('Pipeline', 'Ошибка отправки PDF', err.message);
            }
        } else {
            leadsStore.updatePipeline(leadId, 'kpSent');
            logger.demo('Pipeline', `КП ${pdf.filename} "отправлено" клиенту ${leadData.name}`);
        }

        // Обновляем статус в CRM
        if (leadData.dealId) {
            await bitrix24.updateDealStatus(leadData.dealId, 'PROPOSAL');
        }

        logger.success('Pipeline', `✅ Конвейер завершён для ${leadData.name}`);
    }

    /**
     * Отправить фото дома клиенту
     */
    async _sendHouseImage(chatId, leadData) {
        const imgPath = getHouseImagePath(
            leadData.floors || '1',
            leadData.floorType || 'full',
            leadData.roofStyle || 'gable'
        );

        if (!imgPath) {
            logger.warn('Bot', 'Фото дома не найдено для данной конфигурации');
            return;
        }

        const caption = getHouseCaption(
            leadData.floors || '1',
            leadData.floorType || 'full',
            leadData.roofStyle || 'gable'
        );

        if (this.bot) {
            try {
                await this.bot.sendPhoto(chatId, imgPath, {
                    caption: caption + '\n\nВот как может выглядеть ваш будущий дом! 🏡',
                });
                logger.success('Bot', `Фото дома отправлено: ${imgPath}`);
            } catch (err) {
                logger.error('Bot', 'Ошибка отправки фото дома', err.message);
            }
        } else {
            logger.demo('Bot', `[Chat ${chatId}] Отправлено фото дома: ${caption}`);
        }
    }

    /**
     * Тестовый лид для демо (/test)
     */
    async _handleTestLead(chatId) {
        const testData = {
            chatId,
            name: 'Тестовый Клиент',
            services: ['foundation', 'sip_box', 'roof', 'facade', 'windows'],
            area: 120,
            budget: 4500000,
            location: 'Московская область, Одинцово',
            phone: '+7 (999) 123-45-67',
            paymentForm: 'cash',
            timing: 'soon',
            floors: '1',
            roofStyle: 'gable',
            wallHeight: '2.5',
        };

        await this._send(chatId, '🧪 *Запускаем тестовый сценарий...*', { parse_mode: 'Markdown' });
        await this._processConfirmedLead(chatId, testData);
    }

    /**
     * Симуляция сообщения (для демо API)
     */
    async simulateMessage(chatId, text) {
        if (text === '/start') {
            await this._handleStart(chatId, 'Демо-Пользователь');
            return { state: this.sessions.get(chatId)?.state, message: 'Диалог начат' };
        }
        if (text === '/test') {
            await this._handleTestLead(chatId);
            return { state: 'processing', message: 'Тестовый лид создан' };
        }

        await this._handleMessage(chatId, text);
        const session = this.sessions.get(chatId);
        return { state: session?.state || 'done', data: session?.data };
    }

    /**
     * Симуляция callback (для демо API)
     */
    async simulateCallback(chatId, callbackData) {
        const fakeQuery = {
            message: { chat: { id: chatId } },
            data: callbackData,
            id: 'demo',
        };
        await this._handleCallback(fakeQuery);
        const session = this.sessions.get(chatId);
        return { state: session?.state || 'done', data: session?.data };
    }

    /**
     * Универсальная отправка сообщения
     */
    async _send(chatId, text, options = {}) {
        if (this.bot) {
            try {
                return await this.bot.sendMessage(chatId, text, options);
            } catch (err) {
                logger.error('Bot', 'send error', err.message);
            }
        } else {
            logger.demo('Bot', `[Chat ${chatId}] ${text.replace(/\*/g, '').substring(0, 100)}...`);
        }
    }

    async _answerCallback(callbackId, text) {
        if (this.bot) {
            try {
                await this.bot.answerCallbackQuery(callbackId, { text });
            } catch (err) {
                // ignore
            }
        }
    }
}

module.exports = new TelegramBot();
