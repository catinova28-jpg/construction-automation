/**
 * Реальные данные по этапам строительства ПСК «ХОРС»
 * Источник: кп 1 эт предчистовая антигравити.xlsx
 * Цена за м² определяется динамически по конфигурации дома
 */

const { getBasePricePerSqm } = require('../bot/qualification');

// Структура этапов основного строительства
const CONSTRUCTION_STAGES = {
    // ========== ОСНОВНОЕ СТРОИТЕЛЬСТВО ==========
    foundation: {
        id: 'foundation',
        stage: 'I',
        name: 'Фундамент. Цокольное перекрытие',
        icon: '🏗️',
        // Процент от базовой стоимости (188100 / 2351250 ≈ 8%)
        percentOfBase: 0.08,
        items: [
            { id: 'I.1', name: 'Подготовительный этап и обеспечение объекта' },
            { id: 'I.2', name: 'Геодезические работы по разбивке осей с закреплением на местности' },
            { id: 'I.3', name: 'Ж/б столбы ф300-350 мм (бетон М300, В 22,5), проф.труба 100×100×3 мм, арматура 12 мм (АIII), обработка мастичным гидроизоляционным составом' },
            { id: 'I.4', name: 'Ростверк из составной проф трубы 100×100×3 мм' },
            { id: 'I.5', name: 'СИП панель 2500×1250×174 мм (OSB-3 12 мм / ППС 16Ф 150 мм). Соединительный брус 148×48 мм, антисептированный. Торцевая доска 148×48 мм' },
        ],
        note: 'Цена актуальна для участков с перепадом высот не более 60 см. Для участков с большим перепадом требуется перерасчёт стоимости фундамента.',
    },

    sip_box: {
        id: 'sip_box',
        stage: 'II',
        name: 'Наружные стены и внутренние перегородки',
        icon: '🧱',
        // Процент от базовой стоимости (1293187 / 2351250 ≈ 55%)
        percentOfBase: 0.55,
        items: [
            { id: 'II.1', name: 'Наружные стены первого этажа из СИП панелей 174×1250×2500 мм (OSB 12 мм + ПСБ 149 мм + OSB 12 мм)' },
            { id: 'II.2', name: 'Перегородки первого этажа из СИП панелей 118×1250×2500 мм (OSB 9 мм + ПСБ 100 мм + OSB 9 мм)' },
            { id: 'II.3', name: 'Метизная группа для монтажа стен и перегородок' },
            { id: 'II.4', name: 'Метизная группа для монтажа пола' },
            { id: 'II.5', name: 'Пиломатериал доска естественной влажности, соединительный брус 148×48 мм, торцевая доска 148×48 мм' },
        ],
        note: null,
    },

    roof: {
        id: 'roof',
        stage: 'IV',
        name: 'Кровля',
        icon: '🏠',
        // Процент от базовой стоимости (470250 / 2351250 ≈ 20%)
        percentOfBase: 0.20,
        items: [
            { id: 'IV.1', name: 'Обрешётка доской 25×100' },
            { id: 'IV.2', name: 'Плёнка пароизоляция' },
            { id: 'IV.3', name: 'Утеплитель GEO 44 RN 8200×1220×50 мм. Утепление в три слоя' },
            { id: 'IV.4', name: 'Доска 150×50 (стропильная система)' },
            { id: 'IV.5', name: 'Гидро-пароизоляция' },
            { id: 'IV.6', name: 'Обрешётка доской 25×100' },
            { id: 'IV.7', name: 'OSB 9 мм, 1250×2500 мм' },
            { id: 'IV.8', name: 'Подкладочный ковёр' },
            { id: 'IV.9', name: 'Битумная черепица Технониколь' },
            { id: 'IV.10', name: 'Карнизная планка 8017' },
            { id: 'IV.11', name: 'Коньковый вентиль для мягкой кровли AIRIDGE FELT' },
        ],
        note: null,
    },

    montage: {
        id: 'montage',
        stage: 'V',
        name: 'Монтажные работы',
        icon: '🔧',
        // Процент от базовой стоимости (399712 / 2351250 ≈ 17%)
        percentOfBase: 0.17,
        items: [
            { id: 'V.1', name: 'Монтаж фундамента' },
            { id: 'V.2', name: 'Монтаж домокомплекта' },
            { id: 'V.3', name: 'Монтаж кровли' },
        ],
        note: null,
    },
};

// Межэтажное перекрытие (только для 1.5/2-этажных домов)
const INTERFLOOR_STAGE = {
    id: 'interfloor',
    stage: 'III',
    name: 'Межэтажное перекрытие',
    icon: '🏗️',
    percentOfBase: 0.07, // ~7% от базовой стоимости
    items: [
        { id: 'III.1', name: 'Ферма из доски 150×50' },
        { id: 'III.2', name: 'Плёнка пароизоляция' },
        { id: 'III.3', name: 'Обрешётка доской 25×100' },
        { id: 'III.4', name: 'Звукоизоляция вата на основе базальта' },
        { id: 'III.5', name: 'OSB 12 мм, 1250×2500 мм (Талион/Калевала)' },
    ],
    note: null,
};

// Доп. позиция для sip_box на 2-этажных домах
const SECOND_FLOOR_PARTITION = {
    id: 'II.6',
    name: 'Перегородки второго этажа из СИП панелей 118×1250×2500 мм (OSB 9 мм + ПСБ 100 мм + OSB 9 мм (±3мм))',
};

// ========== ДОПОЛНИТЕЛЬНЫЕ ОПЦИИ ==========
const ADDITIONAL_OPTIONS = {
    windows: {
        id: 'windows',
        name: 'Окна REHAU GRAZIO',
        icon: '🪟',
        description: 'Профиль REHAU GRAZIO белый, трёхкамерный, фурнитура Maco, стеклопакет 4-16-4',
        pricePerUnit: 14000,
        unit: 'м² остекления',
        // Расчёт: 2 м² остекления на каждые 10 м² площади дома
        estimatePerSqm: function (area) {
            const windowArea = Math.round(area * 0.2 * 10) / 10; // 2 м² на 10 м²
            return { count: windowArea, price: Math.round(windowArea * this.pricePerUnit) };
        },
    },

    door: {
        id: 'door',
        name: 'Дверь входная металлическая',
        icon: '🚪',
        description: 'Дверь входная металлическая',
        fixedPrice: 18900,
        count: 1,
    },

    facade: {
        id: 'facade',
        name: 'Фасад',
        icon: '🏢',
        description: 'Хауберг мягкий кирпич: водосточная система, фасадный материал, подшива, цокольные панели, монтажные работы',
        pricePerSqm: 5000,
        cokol_height: 0.6, // Высота цоколя 60 см
        parapet_height: 0.5, // Высота парапета для хайтек
        /**
         * Расчёт площади фасада по типу дома
         * Формула из Excel ПСК «ХОРС» (утверждена директором по строительству):
         *   1 этаж:    (L+W)×2×(H1+0.2)  +  0.6×(L+W)×4
         *   1.5 этажа: (L+W)×2×(H1+0.2)  +  (L+W)×2×(H2+0.5)  +  0.6×(L+W)×4
         *   2 этажа:   (L+W)×2×(H1+0.2)  +  (L+W)×2×(H2+0.2)  +  0.6×(L+W)×4
         *
         * +0.2 / +0.5 — запас на обвязку/переход к скату
         * ×4 на цоколе — запас на обрезку материала и перепад высот
         */
        estimatePrice: function (length, width, floors, floorType, roofStyle, wallHeight) {
            const halfPerimeter = length + width; // L + W
            const isMultiFloor = floors === '1.5' || floors === '15' || floors === '2' || floorType === 'mansard';

            // Цоколь: 0.6 × (L+W) × 4 (с запасом на обрезку и перепад)
            const cokolArea = this.cokol_height * halfPerimeter * 4;

            // Стены 1-го этажа: (L+W) × 2 × (H1 + 0.2)
            const wallHeight1 = parseFloat(wallHeight) || 2.5;
            const floor1Area = halfPerimeter * 2 * (wallHeight1 + 0.2);

            let floor2Area = 0;
            if (isMultiFloor) {
                if (floorType === 'mansard' || floors === '1.5' || floors === '15') {
                    // Мансарда: (L+W) × 2 × (H2 + 0.5)
                    const wallHeight2 = 1.25;
                    floor2Area = halfPerimeter * 2 * (wallHeight2 + 0.5);
                } else {
                    // Полный 2-й этаж: (L+W) × 2 × (H2 + 0.2)
                    const wallHeight2 = parseFloat(wallHeight) || 2.5;
                    floor2Area = halfPerimeter * 2 * (wallHeight2 + 0.2);
                }
            }

            const totalFacadeArea = Math.round((floor1Area + floor2Area + cokolArea) * 100) / 100;
            return {
                facadeArea: totalFacadeArea,
                cokolArea: Math.round(cokolArea * 100) / 100,
                wallArea: Math.round((floor1Area + floor2Area) * 100) / 100,
                extraArea: 0,
                price: Math.round(totalFacadeArea * this.pricePerSqm),
            };
        },
    },

    terrace: {
        id: 'terrace',
        name: 'Терраса',
        icon: '🌿',
        description: 'Фундамент свайный, пол доска антисептированная, кровля + 3 ступени каркас. Отделка: цокольные панели, соединительные элементы, подшивка, обрамление, монтажные работы + 3 ступени обрамление',
        // Цена за м² террасы по перечню работ
        pricePerSqm: 24000,
    },

    drywall: {
        id: 'drywall',
        name: 'Гипсокартон (ГКЛ)',
        icon: '📐',
        description: 'Гипсокартон: материал и монтаж по внутренней площади дома',
        pricePerSqm: 3500, // 224438 / 64.125 ≈ 3500₽/м²
    },

    plumbing: {
        id: 'plumbing',
        name: 'Водопровод и канализация',
        icon: '🚰',
        description: 'Водоподведение и водоотведение внутри дома: материал и монтаж',
        pricePerSqm: 1000,
    },

    electricity: {
        id: 'electricity',
        name: 'Электричество по ГОСТ',
        icon: '⚡',
        description: 'Электричество по ГОСТ: материал и монтаж',
        pricePerSqm: 2500, // 160313 / 64.125 ≈ 2500₽/м²
    },

    delivery: {
        id: 'delivery',
        name: 'Доставка',
        icon: '🚛',
        description: 'Доставка фура 20 т. Расчёт по автодороге от Краснодара',
        pricePerKm: 400,
        note: 'Стоимость доставки рассчитывается по расстоянию от Краснодара: 400 ₽/км',
    },
};

/**
 * Рассчитать полную смету по параметрам дома
 * @param {Object} params - Параметры дома
 * @param {string} params.floors - Этажность: '1' | '2'
 * @param {string} params.floorType - Тип 2-го этажа: 'mansard' | 'full' (для 2-этажных)
 * @param {string} params.roofStyle - Стиль кровли: 'gable' | 'hitech'
 * @param {string} params.wallHeight - Высота стен: '2.5' | '2.8' | '3.0'
 * @param {number} params.area - Площадь м²
 * @param {number} params.length - Длина м (опционально, рассчитывается из площади)
 * @param {number} params.width - Ширина м (опционально)
 * @param {number} params.terraceArea - Площадь террасы м² (если не задана, 15% от площади дома)
 * @param {string[]} params.selectedServices - Массив id выбранных услуг
 * @param {string} params.location - Адрес участка (для расчёта доставки)
 * @returns {Object} Полная смета
 */
async function calculateEstimate(params) {
    const { area, selectedServices = [] } = params;
    const floors = params.floors || '1';
    const floorType = params.floorType || 'full';
    const roofStyle = params.roofStyle || 'gable';
    const wallHeight = params.wallHeight || '2.5';
    const wallHeightNum = parseFloat(wallHeight);

    // Динамическая цена за м² по конфигурации
    const basePricePerSqm = getBasePricePerSqm(floors, floorType, wallHeight);

    // Размеры: для 1.5/2-этажных домов L×W считается от площади одного этажа (пятно застройки)
    const isMultiFloor = floors === '2' || floors === '1.5' || floors === '15' || floorType === 'mansard';
    const footprint = isMultiFloor ? area / 2 : area; // для 1.5 и 2 этажей — площадь делится на 2
    const length = params.length || Math.sqrt(footprint * 1.27);
    const width = params.width || footprint / length;

    // Внутренняя площадь (примерно 90% от общестроительной)
    const innerArea = area * 0.9;

    // Базовая стоимость
    const baseTotal = area * basePricePerSqm;

    // Для многоэтажных домов добавляется межэтажное перекрытие (7%).
    // Чтобы сумма этапов = baseTotal (100%), нормализуем все проценты.
    // 1 этаж: 8+55+20+17 = 100% -> коэффициент 1.0
    // 1.5/2 этажа: 8+55+7+20+17 = 107% -> коэффициент 1/1.07 ≈ 0.9346
    const totalPercent = isMultiFloor
        ? (0.08 + 0.55 + INTERFLOOR_STAGE.percentOfBase + 0.20 + 0.17)
        : 1.0;
    const normFactor = 1.0 / totalPercent;

    // Расчёт основных этапов
    const stages = [];
    Object.values(CONSTRUCTION_STAGES).forEach(stage => {
        const stagePrice = Math.round(baseTotal * stage.percentOfBase * normFactor);
        const stageData = {
            ...stage,
            items: [...stage.items],
            price: stagePrice,
        };
        // Для 1.5/2-этажных домов добавляем перегородки 2-го этажа в sip_box
        if (stage.id === 'sip_box' && isMultiFloor) {
            stageData.items.push(SECOND_FLOOR_PARTITION);
        }
        stages.push(stageData);
    });

    // Для 1.5/2-этажных добавляем межэтажное перекрытие после sip_box (этап III)
    if (isMultiFloor) {
        const interfloorPrice = Math.round(baseTotal * INTERFLOOR_STAGE.percentOfBase * normFactor);
        // Вставляем после sip_box (индекс 1), перед кровлей
        const sipBoxIdx = stages.findIndex(s => s.id === 'sip_box');
        stages.splice(sipBoxIdx + 1, 0, {
            ...INTERFLOOR_STAGE,
            price: interfloorPrice,
        });
    }

    // Расчёт дополнительных опций
    const options = [];
    const serviceMap = {
        'windows': 'windows',
        'facade': 'facade',
        'terrace': 'terrace',
        'drywall': 'drywall',
        'engineering': null, // разбивается на plumbing + electricity
    };

    // Всегда включаем дверь
    options.push({
        ...ADDITIONAL_OPTIONS.door,
        price: ADDITIONAL_OPTIONS.door.fixedPrice,
        quantity: 1,
    });

    if (selectedServices.includes('windows')) {
        const est = ADDITIONAL_OPTIONS.windows.estimatePerSqm(area);
        options.push({
            ...ADDITIONAL_OPTIONS.windows,
            price: est.price,
            quantity: est.count,
        });
    }

    if (selectedServices.includes('facade')) {
        const est = ADDITIONAL_OPTIONS.facade.estimatePrice(length, width, floors, floorType, roofStyle, wallHeightNum);
        options.push({
            ...ADDITIONAL_OPTIONS.facade,
            price: est.price,
            facadeArea: est.facadeArea,
            quantity: est.facadeArea,
            details: `Стены: ${est.wallArea} м², Цоколь: ${est.cokolArea} м², ${roofStyle === 'gable' ? 'Фронтоны' : 'Парапет'}: ${est.extraArea} м²`,
        });
    }

    if (selectedServices.includes('terrace')) {
        // Площадь террасы: из параметров или 15% от площади дома
        const terraceArea = params.terraceArea || Math.round(area * 0.15);
        const terracePrice = terraceArea * ADDITIONAL_OPTIONS.terrace.pricePerSqm;
        options.push({
            ...ADDITIONAL_OPTIONS.terrace,
            price: terracePrice,
            quantity: terraceArea,
        });
    }

    if (selectedServices.includes('drywall')) {
        options.push({
            ...ADDITIONAL_OPTIONS.drywall,
            price: Math.round(innerArea * ADDITIONAL_OPTIONS.drywall.pricePerSqm),
            quantity: innerArea,
        });
    }

    if (selectedServices.includes('engineering')) {
        options.push({
            ...ADDITIONAL_OPTIONS.plumbing,
            price: Math.round(innerArea * ADDITIONAL_OPTIONS.plumbing.pricePerSqm),
            quantity: innerArea,
        });
        options.push({
            ...ADDITIONAL_OPTIONS.electricity,
            price: Math.round(innerArea * ADDITIONAL_OPTIONS.electricity.pricePerSqm),
            quantity: innerArea,
        });
    }

    // Доставка — расчёт по расстоянию от Краснодара
    const { calculateDelivery } = require('./distance');
    const deliveryInfo = await calculateDelivery(params.location);
    if (deliveryInfo && deliveryInfo.distanceKm > 0) {
        options.push({
            ...ADDITIONAL_OPTIONS.delivery,
            description: 'Фура 20 т, Краснодар → ' + (params.location || '') + ' (' + deliveryInfo.distanceKm + ' км × ' + ADDITIONAL_OPTIONS.delivery.pricePerKm + ' ₽/км)',
            price: deliveryInfo.price,
            quantity: deliveryInfo.distanceKm + ' км',
        });
    } else {
        // Если не удалось рассчитать расстояние — ставим пометку
        options.push({
            ...ADDITIONAL_OPTIONS.delivery,
            description: 'Фура 20 т. Расстояние уточняется (400 ₽/км от Краснодара)',
            price: 0,
            quantity: 'по запросу',
        });
    }

    const stagesTotalPrice = stages.reduce((sum, s) => sum + s.price, 0);
    const optionsTotalPrice = options.reduce((sum, o) => sum + o.price, 0);
    const totalCash = stagesTotalPrice + optionsTotalPrice;
    const totalMortgage = Math.round(totalCash * 1.08); // +8% ипотечная наценка

    return {
        params: { area, length: Math.round(length * 10) / 10, width: Math.round(width * 10) / 10, wallHeight: wallHeightNum, innerArea },
        pricePerSqm: basePricePerSqm,
        houseConfig: {
            floors,
            floorType: floors === '2' ? floorType : null,
            roofStyle,
            wallHeight,
        },
        stages,
        options,
        stagesTotalPrice,
        optionsTotalPrice,
        totalCash,
        totalMortgage,
        companyInfo: {
            name: 'Производственно-строительная компания «ХОРС»',
            address: 'Краснодар, пос. Перекатный, ул. Апельсиновая 10А',
            officeAddress: 'Республика Адыгея, Тургеневское шоссе, 2',
            phone: '8 (988) 246-02-02',
            website: 'https://domasmplus.ru',
            catalog: 'https://asmplus.bitrix24.ru/~3RN5P',
            advantages: [
                'Построили более 500 домов и гостиниц за 17 лет',
                'Собственное производство СИП-панелей',
                'Материалы по ценам производителей',
                '42% домов строим быстрее срока, скорость постройки от 3-х недель',
                'Фиксированная цена по договору',
                'Срок службы домов от 80 лет',
                'Ежедневная отчётность по этапам строительства',
            ],
        },
        notes: [
            'Данное коммерческое предложение является предварительным. Итоговая смета рассчитывается только по проекту.',
            'Консультация инженера с выездом на участок — 5 000 руб. В пределах 150 км от Краснодара.',
            'Консультация инженера с геодезическим исследованием участка — 10 000 руб. При заключении договора на строительство предоставляется скидка на эту сумму.',
        ],
    };
}

module.exports = {
    CONSTRUCTION_STAGES,
    ADDITIONAL_OPTIONS,
    calculateEstimate,
};
