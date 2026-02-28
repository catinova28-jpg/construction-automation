/**
 * Утилита для определения пути к картинке дома
 * По этажности, типу этажа и стилю кровли
 */

const path = require('path');
const fs = require('fs');

const IMG_DIR = path.join(__dirname, '../../dashboard/img');

/**
 * Определить ключ этажности для имени файла
 * floors='1' → '1', floors='2'+mansard → '15', floors='2'+full → '2'
 */
function getFloorKey(floors, floorType, roofStyle) {
    // Хай-тек всегда с полноценным 2-м этажом
    if (roofStyle === 'hitech' && (floorType === 'mansard' || floors === '1.5' || floors === '15')) return '2';
    if (floors === '1.5' || floors === '15' || floorType === 'mansard') return '15';
    if (floors === '2') return '2';
    return '1';
}

/**
 * Определить ключ стиля для имени файла
 * hitech/flat/shed → 'flat', gable → 'gable'
 */
function getRoofKey(roofStyle) {
    return (roofStyle === 'flat' || roofStyle === 'shed' || roofStyle === 'hitech') ? 'flat' : 'gable';
}

/**
 * Получить абсолютный путь к картинке дома
 * @returns {string|null} путь к файлу или null если не найден
 */
function getHouseImagePath(floors, floorType, roofStyle) {
    const floorKey = getFloorKey(floors, floorType, roofStyle);
    const roofKey = getRoofKey(roofStyle);
    const filename = 'house_' + floorKey + '_' + roofKey + '.png';
    const imgPath = path.join(IMG_DIR, filename);

    if (fs.existsSync(imgPath)) {
        return imgPath;
    }
    return null;
}

/**
 * Получить подпись для картинки дома
 */
function getHouseCaption(floors, floorType, roofStyle) {
    let floorLabel;
    // Хай-тек всегда полноценный 2-й этаж
    if (roofStyle === 'hitech' && (floorType === 'mansard' || floors === '1.5' || floors === '15')) {
        floorLabel = '2 этажа';
    } else if (floors === '1.5' || floors === '15' || floorType === 'mansard') {
        floorLabel = '1,5 этажа';
    } else if (floors === '2') {
        floorLabel = '2 этажа';
    } else {
        floorLabel = '1 этаж';
    }

    const styleLabel = (roofStyle === 'flat' || roofStyle === 'shed' || roofStyle === 'hitech')
        ? 'Хай-тек'
        : 'Классика';

    return '🏠 ' + floorLabel + ' · ' + styleLabel;
}

module.exports = { getHouseImagePath, getHouseCaption, getFloorKey, getRoofKey };
