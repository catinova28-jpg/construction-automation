/**
 * Калькулятор расстояния от Краснодара до участка
 * Использует бесплатный OSRM API (OpenStreetMap) для расчёта по автодорогам
 * Стоимость доставки: 400 ₽/км (фура 20 тонн)
 */

const logger = require('../utils/logger');

// Координаты Краснодара (центр / производство)
const KRASNODAR = { lat: 45.0355, lon: 38.9753 };

// Стоимость за километр
const PRICE_PER_KM = 400;

/**
 * Получить координаты по названию города/адреса
 * Используем Nominatim (OpenStreetMap)
 */
async function geocode(location) {
    try {
        const query = encodeURIComponent(location + ', Россия');
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ru`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'PSK-HORS-KP-Calculator/1.0' },
        });
        const data = await response.json();

        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon),
                displayName: data[0].display_name,
            };
        }
        return null;
    } catch (err) {
        logger.error('Distance', 'Ошибка геокодирования', err.message);
        return null;
    }
}

/**
 * Получить расстояние по авто-дороге через OSRM
 * @returns расстояние в км
 */
async function getRoadDistance(fromCoords, toCoords) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=false`;

        const response = await fetch(url);
        const data = await response.json();

        if (data && data.routes && data.routes.length > 0) {
            const distanceMeters = data.routes[0].distance;
            const distanceKm = Math.round(distanceMeters / 1000);
            return distanceKm;
        }
        return null;
    } catch (err) {
        logger.error('Distance', 'Ошибка OSRM', err.message);
        return null;
    }
}

/**
 * Рассчитать стоимость доставки от Краснодара до указанного адреса
 * @param {string} location — название города или адрес участка
 * @returns {Object} { distanceKm, price, displayName } или null
 */
async function calculateDelivery(location) {
    if (!location) return null;

    // Геокодируем адрес
    const coords = await geocode(location);
    if (!coords) {
        logger.warn('Distance', 'Не удалось определить координаты для: ' + location);
        return null;
    }

    // Считаем расстояние по дороге
    const distanceKm = await getRoadDistance(KRASNODAR, coords);
    if (!distanceKm) {
        logger.warn('Distance', 'Не удалось рассчитать маршрут до: ' + location);
        return null;
    }

    const price = distanceKm * PRICE_PER_KM;

    logger.info('Distance', `Краснодар → ${location}: ${distanceKm} км × ${PRICE_PER_KM} ₽/км = ${price.toLocaleString('ru-RU')} ₽`);

    return {
        from: 'Краснодар',
        to: location,
        displayName: coords.displayName,
        distanceKm,
        pricePerKm: PRICE_PER_KM,
        price,
    };
}

module.exports = {
    KRASNODAR,
    PRICE_PER_KM,
    geocode,
    getRoadDistance,
    calculateDelivery,
};
