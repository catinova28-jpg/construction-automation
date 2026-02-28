/**
 * Логика квалификации лида
 * Определяет "температуру" лида на основе собранных данных
 */

// Услуги строительной компании
const SERVICES = [
    { id: 'foundation', name: 'Фундамент', icon: '🏗️', basePrice: 350000 },
    { id: 'sip_box', name: 'Основная коробка из СИП панелей', icon: '🏠', basePrice: 1200000 },
    { id: 'roof', name: 'Кровля', icon: '🏚️', basePrice: 450000 },
    { id: 'facade', name: 'Фасад', icon: '🧱', basePrice: 380000 },
    { id: 'windows', name: 'Окна', icon: '🪟', basePrice: 250000 },
    { id: 'terrace', name: 'Терраса', icon: '🌿', basePrice: 200000 },
    { id: 'engineering', name: 'Инженерные коммуникации', icon: '⚡', basePrice: 500000 },
    { id: 'drywall', name: 'ГКЛ (гипсокартон)', icon: '📐', basePrice: 300000 },
];

// Состояния FSM диалога
const STATES = {
    START: 'start',
    NAME: 'name',
    SERVICE: 'service',
    AREA: 'area',
    FLOORS: 'floors',
    FLOOR_TYPE: 'floor_type',
    ROOF_STYLE: 'roof_style',
    WALL_HEIGHT: 'wall_height',
    BUDGET: 'budget',
    LOCATION: 'location',
    PHONE: 'phone',
    PAYMENT: 'payment',
    TIMING: 'timing',
    CONFIRM: 'confirm',
    DONE: 'done',
};

// Варианты этажности
const FLOOR_OPTIONS = [
    { id: '1', name: '1 этаж', icon: '🏠' },
    { id: '2', name: '2 этажа', icon: '🏢' },
];

// Тип 2-го этажа
const FLOOR_TYPE_OPTIONS = [
    { id: 'mansard', name: 'Мансардный этаж (стены 1.25 м)', icon: '🔺' },
    { id: 'full', name: 'Полноценный 2-й этаж', icon: '⬜' },
];

// Стиль кровли
const ROOF_STYLE_OPTIONS = [
    { id: 'gable', name: 'Классическая двускатная', icon: '🏚️' },
    { id: 'hitech', name: 'Хайтек с парапетом', icon: '🔲' },
];

// Высота стен
const WALL_HEIGHT_OPTIONS = [
    { id: '2.5', name: '2.5 м (стандарт)', icon: '📏', value: 2.5 },
    { id: '2.8', name: '2.8 м', icon: '📐', value: 2.8 },
    { id: '3.0', name: '3.0 м', icon: '📐', value: 3.0 },
];

// Ценовая матрица: цена за м² коробки
const PRICE_MATRIX = {
    // 1 этаж
    '1_2.5': 34000,
    '1_2.8': 34500,
    '1_3.0': 35000,
    // 2 этажа мансарда (фикс)
    '2_mansard': 32500,
    // 2 этажа полный
    '2_full_2.5': 33000,
    '2_full_2.8': 34000,
    '2_full_3.0': 34500,
};

/**
 * Получить цену за м² по конфигурации дома
 */
function getBasePricePerSqm(floors, floorType, wallHeight) {
    // 1.5 этажа (мансарда) — всегда 32 500 ₽/м²
    if (floors === '1.5' || floors === '15' || floorType === 'mansard') {
        return PRICE_MATRIX['2_mansard'];
    }
    // 2 полных этажа
    if (floors === '2') {
        return PRICE_MATRIX[`2_full_${wallHeight}`] || PRICE_MATRIX['2_full_2.5'];
    }
    // 1 этаж
    return PRICE_MATRIX[`1_${wallHeight}`] || PRICE_MATRIX['1_2.5'];
}

// Варианты формы оплаты
const PAYMENT_OPTIONS = [
    { id: 'cash', name: 'Наличные / собственные средства', icon: '💵' },
    { id: 'mortgage', name: 'Ипотека', icon: '🏦' },
    { id: 'none', name: 'Пока нет средств', icon: '❌' },
];

// Варианты сроков начала строительства
const TIMING_OPTIONS = [
    { id: 'soon', name: 'В ближайшие 2-3 месяца', icon: '⏰' },
    { id: 'later', name: 'Через полгода-год', icon: '📅' },
    { id: 'looking', name: 'Только присматриваюсь', icon: '👀' },
];

/**
 * Оценка "температуры" лида
 * Категория A (горячий): наличные + старт в 2-3 мес
 * Категория B (средний): ипотека (любые сроки)
 * Категория C (холодный): нет средств / только присматривается
 */
function scoreLead(leadData) {
    const payment = leadData.paymentForm || 'none';
    const timing = leadData.timing || 'looking';

    let temperature;
    let category;

    if (payment === 'cash' && timing === 'soon') {
        // Категория А — горячий лид
        temperature = 'hot';
        category = 'A';
    } else if (payment === 'mortgage') {
        // Категория B — средней горячести
        temperature = 'warm';
        category = 'B';
    } else if (payment === 'cash' && timing === 'later') {
        // Наличные но не скоро — тёплый
        temperature = 'warm';
        category = 'B';
    } else {
        // Нет денег / только присматривается — холодный
        temperature = 'cold';
        category = 'C';
    }

    // Вспомогательный числовой скор для CRM/дашборда
    let score = 0;
    if (leadData.budget >= 3000000) score += 30;
    else if (leadData.budget >= 1000000) score += 20;
    else if (leadData.budget >= 500000) score += 10;

    if (leadData.area >= 150) score += 20;
    else if (leadData.area >= 80) score += 15;
    else if (leadData.area >= 40) score += 10;

    if (leadData.services && leadData.services.includes('full')) score += 20;
    else if (leadData.services && leadData.services.length >= 3) score += 15;

    if (leadData.phone) score += 10;
    if (leadData.location) score += 10;

    return {
        score,
        temperature,
        category,
        label: temperature === 'hot' ? '🔥 Горячий (A)' : temperature === 'warm' ? '🌤️ Тёплый (B)' : '❄️ Холодный (C)',
    };
}

/**
 * Рассчёт приблизительной стоимости
 */
function estimateCost(leadData) {
    if (!leadData.services || leadData.services.length === 0) return 0;

    let total = 0;
    const areaMultiplier = leadData.area ? leadData.area / 100 : 1;

    leadData.services.forEach(serviceId => {
        const service = SERVICES.find(s => s.id === serviceId);
        if (service) {
            total += service.basePrice * areaMultiplier;
        }
    });

    return Math.round(total);
}

module.exports = {
    SERVICES, STATES,
    FLOOR_OPTIONS, FLOOR_TYPE_OPTIONS, ROOF_STYLE_OPTIONS, WALL_HEIGHT_OPTIONS,
    PAYMENT_OPTIONS, TIMING_OPTIONS,
    PRICE_MATRIX, getBasePricePerSqm,
    scoreLead, estimateCost,
};
