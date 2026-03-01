/**
 * HTML-шаблон коммерческого предложения — ПСК «ХОРС»
 * На основе реальных данных из pricing.js
 */

const fs = require('fs');
const path = require('path');

// Загрузка изображений домов как base64
function getHouseImageBase64(floors, roofStyle, floorType) {
  // Хай-тек всегда полноценный 2-й этаж
  var isHitech = (roofStyle === 'flat' || roofStyle === 'shed' || roofStyle === 'hitech');
  var floorKey;
  if (isHitech && (floorType === 'mansard' || floors === '1.5' || floors === '15')) {
    floorKey = '2';
  } else {
    floorKey = floors === '2' ? '2' : (floors === '1.5' || floors === '15') ? '15' : '1';
  }
  var roofKey = isHitech ? 'flat' : 'gable';
  var filename = 'house_' + floorKey + '_' + roofKey + '.png';
  var imgPath = path.join(__dirname, '../../../dashboard/img/', filename);
  try {
    var buf = fs.readFileSync(imgPath);
    return 'data:image/png;base64,' + buf.toString('base64');
  } catch (e) {
    return '';
  }
}

// Подпись этажности
function getFloorLabel(floors, floorType, roofStyle) {
  var isHitech = (roofStyle === 'flat' || roofStyle === 'shed' || roofStyle === 'hitech');
  if (floors === '2') return '2 этажа';
  if (isHitech && (floorType === 'mansard' || floors === '1.5' || floors === '15')) return '2 этажа';
  if (floors === '1.5' || floors === '15' || floorType === 'mansard') return '1,5 этажа';
  return '1 этаж';
}

// Название стиля
function getStyleLabel(roofStyle) {
  if (roofStyle === 'flat' || roofStyle === 'shed' || roofStyle === 'hitech') return 'Хай-тек (плоская кровля)';
  return 'Классический (двускатная кровля)';
}

function generateKPTemplate(proposal, leadData) {
  // Этапы основного строительства
  var stagesHTML = (proposal.stages || []).map(function (stage) {
    var itemsHTML = (stage.items || []).map(function (item) {
      return '<tr><td class="item-id">' + item.id + '</td><td>' + item.name + '</td></tr>';
    }).join('');
    var noteHTML = stage.note ? '<div class="stage-note">⚠️ ' + stage.note + '</div>' : '';
    return '<div class="stage-block">' +
      '<div class="stage-header">' +
      '<div class="stage-title">' +
      '<span class="stage-icon">' + stage.icon + '</span>' +
      '<span class="stage-num">' + stage.stage + '.</span>' +
      '<h3>' + stage.name + '</h3>' +
      '</div>' +
      '<div class="stage-price">' + (stage.price || 0).toLocaleString('ru-RU') + ' ₽</div>' +
      '</div>' +
      '<table class="items-table"><tbody>' + itemsHTML + '</tbody></table>' +
      noteHTML +
      '</div>';
  }).join('');

  // Дополнительные опции
  var optionsHTML = (proposal.options || []).map(function (opt) {
    var qty = opt.quantity ? (typeof opt.quantity === 'number' ? Math.round(opt.quantity) : opt.quantity) : '';
    var descSpan = (opt.description && opt.description !== opt.name) ? '<span class="opt-desc">' + opt.description + '</span>' : '';
    return '<tr>' +
      '<td class="opt-icon">' + opt.icon + '</td>' +
      '<td class="opt-name">' + opt.name + descSpan + '</td>' +
      '<td class="opt-qty">' + qty + '</td>' +
      '<td class="opt-price">' + (opt.price || 0).toLocaleString('ru-RU') + ' ₽</td>' +
      '</tr>';
  }).join('');

  // Преимущества компании
  var advantages = (proposal.companyInfo && proposal.companyInfo.advantages) || [];
  var advantagesHTML = advantages.map(function (a) {
    return '<li><span class="check">✓</span> ' + a + '</li>';
  }).join('');

  // Примечания
  var notesHTML = (proposal.notes || []).map(function (n) {
    return '<li>' + n + '</li>';
  }).join('');

  // Параметры
  var area = leadData.area || '—';
  var floors = leadData.floors || '1';
  var floorType = leadData.floorType || 'full';
  var roofStyle = leadData.roofStyle || 'gable';
  var wallHeight = leadData.wallHeight || '2.5';
  var wallHeightNum = parseFloat(wallHeight);
  var pLength = (proposal.params && proposal.params.length) || '—';
  var pWidth = (proposal.params && proposal.params.width) || '—';
  var isHitechRoof = (roofStyle === 'flat' || roofStyle === 'shed' || roofStyle === 'hitech');
  var numFloors = (isHitechRoof && (floorType === 'mansard' || floors === '1.5' || floors === '15')) ? 2 :
    (floorType === 'mansard' || floors === '1.5' || floors === '15') ? 1.5 :
      (floors === '2') ? 2 : 1;
  var location = leadData.location || 'Уточняется';
  var greeting = proposal.greeting || 'Здравствуйте!';
  var companyIntro = proposal.companyIntro || 'Производственно-строительная компания «ХОРС» специализируется на возведении современных энергоэффективных домов из СИП панелей.';
  var pricePerSqm = (proposal.pricePerSqm || 33000).toLocaleString('ru-RU');
  var stagesTotal = (proposal.stagesTotalPrice || 0).toLocaleString('ru-RU');
  var optionsTotal = (proposal.optionsTotalPrice || 0).toLocaleString('ru-RU');
  var totalCash = (proposal.totalCash || proposal.totalCost || 0).toLocaleString('ru-RU');
  var totalMortgage = (proposal.totalMortgage || 0).toLocaleString('ru-RU');
  var dateStr = new Date().toLocaleDateString('ru-RU');
  var kpNum = 'КП-' + Date.now().toString(36).toUpperCase();

  // Изображение дома
  var houseImgSrc = getHouseImageBase64(floors, roofStyle, floorType);
  var floorLabel = getFloorLabel(floors, floorType, roofStyle);
  var styleLabel = getStyleLabel(roofStyle);

  // Размеры по этажам — для 1.5 и 2-этажных домов площадь делится на 2 равные части
  var footprint = numFloors > 1 ? parseFloat(area) / 2 : parseFloat(area);
  var fLength = pLength !== '—' ? parseFloat(pLength).toFixed(1) : '—';
  var fWidth = pWidth !== '—' ? parseFloat(pWidth).toFixed(1) : '—';

  // Высоты этажей
  var floor1Height = wallHeightNum;
  var floor2Height = 0;
  if (numFloors === 1.5) {
    floor1Height = wallHeightNum;
    // Мансардный этаж — по умолчанию 1.25 м
    floor2Height = leadData.wallHeight2 ? parseFloat(leadData.wallHeight2) : 1.25;
  } else if (numFloors === 2) {
    floor1Height = wallHeightNum;
    floor2Height = leadData.wallHeight2 ? parseFloat(leadData.wallHeight2) : wallHeightNum;
  }

  var html = '<!DOCTYPE html>\n<html lang="ru">\n<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>Коммерческое предложение — ПСК «ХОРС»</title>\n' +
    '  <style>\n' +
    '    @import url(\'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap\');\n' +
    '    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
    '    body { font-family: "Inter", -apple-system, sans-serif; color: #1a1a2e; line-height: 1.6; background: #fff; }\n' +
    '    .page { max-width: 850px; margin: 0 auto; }\n' +
    '    .header { background: linear-gradient(135deg, #1a1a2e, #2d3561, #1a1a2e); color: white; padding: 45px 40px; position: relative; overflow: hidden; }\n' +
    '    .header::before { content: ""; position: absolute; top: -50%; right: -20%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%); border-radius: 50%; }\n' +
    '    .company-name { font-size: 26px; font-weight: 700; letter-spacing: 1px; margin-bottom: 4px; position: relative; z-index: 1; }\n' +
    '    .company-tagline { font-size: 13px; color: rgba(255,255,255,0.65); letter-spacing: 1.5px; text-transform: uppercase; position: relative; z-index: 1; }\n' +
    '    .kp-title { font-size: 21px; font-weight: 600; margin-top: 25px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.12); position: relative; z-index: 1; }\n' +
    '    .kp-meta { display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.5); position: relative; z-index: 1; }\n' +
    '    .greeting { padding: 30px 40px; background: #f8f9ff; border-left: 4px solid #6366f1; }\n' +
    '    .greeting h2 { font-size: 19px; color: #1a1a2e; margin-bottom: 10px; }\n' +
    '    .greeting p { font-size: 14px; color: #444; line-height: 1.7; }\n' +
    '    .advantages { padding: 20px 40px 10px; }\n' +
    '    .advantages ul { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }\n' +
    '    .advantages li { font-size: 13px; color: #444; display: flex; align-items: flex-start; gap: 6px; padding: 4px 0; }\n' +
    '    .check { color: #22c55e; font-weight: 700; font-size: 14px; flex-shrink: 0; }\n' +
    '    .house-visual { padding: 25px 40px; text-align: center; }\n' +
    '    .house-visual img { max-width: 100%; max-height: 320px; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }\n' +
    '    .house-visual .style-badge { display: inline-block; margin-top: 10px; padding: 5px 14px; background: #f1f3f9; border-radius: 20px; font-size: 12px; color: #666; }\n' +
    '    .floor-details { padding: 15px 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n' +
    '    .floor-card { padding: 14px 16px; background: #f8f9ff; border: 1px solid #e8eaf0; border-radius: 10px; }\n' +
    '    .floor-card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; font-weight: 600; margin-bottom: 8px; }\n' +
    '    .floor-card-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; }\n' +
    '    .floor-card-label { font-size: 12px; color: #888; }\n' +
    '    .floor-card-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }\n' +
    '    .client-info { padding: 15px 40px; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }\n' +
    '    .info-item { padding: 12px 14px; background: #f1f3f9; border-radius: 8px; }\n' +
    '    .info-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 3px; }\n' +
    '    .info-value { font-size: 15px; font-weight: 600; color: #1a1a2e; }\n' +
    '    .price-sqm-bar { margin: 10px 40px; padding: 16px 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 10px; color: white; display: flex; justify-content: space-between; align-items: center; }\n' +
    '    .price-sqm-label { font-size: 15px; font-weight: 500; }\n' +
    '    .price-sqm-value { font-size: 22px; font-weight: 700; }\n' +
    '    .stages-section { padding: 25px 40px 10px; }\n' +
    '    .section-title { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #6366f1; display: inline-block; }\n' +
    '    .stage-block { background: #fff; border: 1px solid #e8eaf0; border-radius: 10px; margin-bottom: 14px; overflow: hidden; }\n' +
    '    .stage-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: #f8f9ff; border-bottom: 1px solid #eef0f5; }\n' +
    '    .stage-title { display: flex; align-items: center; gap: 8px; }\n' +
    '    .stage-icon { font-size: 22px; }\n' +
    '    .stage-num { font-size: 14px; font-weight: 700; color: #6366f1; }\n' +
    '    .stage-header h3 { font-size: 15px; font-weight: 600; color: #1a1a2e; }\n' +
    '    .stage-price { font-size: 16px; font-weight: 700; color: #6366f1; white-space: nowrap; }\n' +
    '    .items-table { width: 100%; border-collapse: collapse; }\n' +
    '    .items-table td { padding: 8px 18px; font-size: 13px; color: #444; border-bottom: 1px solid #f5f5f5; vertical-align: top; }\n' +
    '    .item-id { width: 45px; font-weight: 600; color: #888; font-size: 12px; }\n' +
    '    .stage-note { padding: 10px 18px; background: #fffbeb; font-size: 12px; color: #92400e; border-top: 1px solid #fde68a; }\n' +
    '    .base-total { margin: 5px 40px 20px; padding: 16px 20px; background: #f1f3f9; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; font-weight: 600; }\n' +
    '    .base-total-label { font-size: 15px; color: #1a1a2e; }\n' +
    '    .base-total-value { font-size: 20px; color: #6366f1; }\n' +
    '    .options-section { padding: 10px 40px 10px; }\n' +
    '    .options-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e8eaf0; border-radius: 10px; overflow: hidden; }\n' +
    '    .options-table th { background: #f8f9ff; padding: 10px 14px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; text-align: left; border-bottom: 1px solid #e8eaf0; }\n' +
    '    .options-table td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f5f5f5; vertical-align: top; }\n' +
    '    .opt-icon { width: 30px; font-size: 18px; text-align: center; }\n' +
    '    .opt-name { color: #1a1a2e; font-weight: 500; }\n' +
    '    .opt-desc { display: block; font-size: 11px; color: #888; font-weight: 400; margin-top: 2px; }\n' +
    '    .opt-qty { text-align: center; color: #666; width: 60px; }\n' +
    '    .opt-price { text-align: right; font-weight: 600; color: #6366f1; white-space: nowrap; width: 110px; }\n' +
    '    .totals-section { margin: 15px 40px 20px; }\n' +
    '    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-radius: 8px; margin-bottom: 8px; }\n' +
    '    .total-options { background: #f1f3f9; }\n' +
    '    .total-cash { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-radius: 12px; padding: 18px 24px; }\n' +
    '    .total-mortgage { background: #f8f9ff; border: 1px dashed #6366f1; }\n' +
    '    .total-label { font-size: 15px; font-weight: 500; }\n' +
    '    .total-value { font-size: 20px; font-weight: 700; }\n' +
    '    .total-cash .total-value { font-size: 24px; }\n' +
    '    .notes-section { padding: 15px 40px; }\n' +
    '    .notes-list { list-style: none; }\n' +
    '    .notes-list li { font-size: 12px; color: #666; padding: 5px 0 5px 16px; position: relative; }\n' +
    '    .notes-list li::before { content: "•"; position: absolute; left: 0; color: #6366f1; font-weight: bold; }\n' +
    '    .cta-section { padding: 30px 40px; background: #f8f9ff; text-align: center; }\n' +
    '    .cta-section p { font-size: 15px; color: #444; line-height: 1.7; max-width: 600px; margin: 0 auto 12px; }\n' +
    '    .cta-highlight { font-size: 18px; font-weight: 700; color: #6366f1; margin-bottom: 8px; }\n' +
    '    .cta-links { margin-top: 14px; display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }\n' +
    '    .cta-link { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; font-size: 13px; font-weight: 600; }\n' +
    '    .cta-address { margin-top: 10px; font-size: 12px; color: #888; }\n' +
    '    .footer { padding: 20px 40px; background: #1a1a2e; color: rgba(255,255,255,0.5); font-size: 11px; text-align: center; }\n' +
    '    .footer strong { color: white; }\n' +
    '    @media print { .page { max-width: 100%; } .stage-block { break-inside: avoid; } }\n' +
    '  </style>\n' +
    '</head>\n<body>\n<div class="page">\n' +

    // HEADER
    '  <div class="header">\n' +
    '    <div class="company-name">🏗️ ПСК «ХОРС»</div>\n' +
    '    <div class="company-tagline">Производственно-строительная компания · Строительство домов из СИП панелей</div>\n' +
    '    <div class="kp-title">Коммерческое предложение</div>\n' +
    '    <div class="kp-meta"><span>Дата: ' + dateStr + '</span><span>' + kpNum + '</span></div>\n' +
    '  </div>\n' +

    // GREETING
    '  <div class="greeting">\n' +
    '    <h2>' + greeting + '</h2>\n' +
    '    <p>' + companyIntro + '</p>\n' +
    '  </div>\n' +

    // ADVANTAGES
    (advantagesHTML ? '  <div class="advantages"><ul>' + advantagesHTML + '</ul></div>\n' : '') +

    // HOUSE IMAGE
    (houseImgSrc ? (
      '  <div class="house-visual">\n' +
      '    <img src="' + houseImgSrc + '" alt="Визуализация дома">\n' +
      '    <div class="style-badge">' + styleLabel + '</div>\n' +
      '  </div>\n'
    ) : '') +

    // CLIENT INFO
    '  <div class="client-info">\n' +
    '    <div class="info-item"><div class="info-label">Площадь дома</div><div class="info-value">' + area + ' м²</div></div>\n' +
    '    <div class="info-item"><div class="info-label">Этажность</div><div class="info-value">' + floorLabel + '</div></div>\n' +
    '    <div class="info-item"><div class="info-label">Размеры (Д×Ш)</div><div class="info-value">' + fLength + ' × ' + fWidth + ' м</div></div>\n' +
    '    <div class="info-item"><div class="info-label">Адрес объекта</div><div class="info-value">' + location + '</div></div>\n' +
    '  </div>\n' +

    // FLOOR DETAILS
    (numFloors > 1 ? (
      '  <div class="floor-details">\n' +
      '    <div class="floor-card">\n' +
      '      <div class="floor-card-title">🏠 1-й этаж</div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Площадь</span><span class="floor-card-value">' + footprint.toFixed(0) + ' м²</span></div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Размеры</span><span class="floor-card-value">' + fLength + ' × ' + fWidth + ' м</span></div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Высота стен</span><span class="floor-card-value">' + floor1Height.toFixed(2) + ' м</span></div>\n' +
      '    </div>\n' +
      '    <div class="floor-card">\n' +
      '      <div class="floor-card-title">' + (numFloors === 1.5 ? '🏠 Мансардный этаж' : '🏠 2-й этаж') + '</div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Площадь</span><span class="floor-card-value">' + footprint.toFixed(0) + ' м²</span></div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Размеры</span><span class="floor-card-value">' + fLength + ' × ' + fWidth + ' м</span></div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Высота стен</span><span class="floor-card-value">' + floor2Height.toFixed(2) + ' м</span></div>\n' +
      '    </div>\n' +
      '  </div>\n'
    ) : (
      '  <div class="floor-details" style="grid-template-columns:1fr">\n' +
      '    <div class="floor-card">\n' +
      '      <div class="floor-card-title">🏠 1-й этаж</div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Площадь</span><span class="floor-card-value">' + area + ' м²</span></div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Размеры</span><span class="floor-card-value">' + fLength + ' × ' + fWidth + ' м</span></div>\n' +
      '      <div class="floor-card-row"><span class="floor-card-label">Высота стен</span><span class="floor-card-value">' + floor1Height.toFixed(2) + ' м</span></div>\n' +
      '    </div>\n' +
      '  </div>\n'
    )) +

    // PRICE PER SQM
    '  <div class="price-sqm-bar">\n' +
    '    <div class="price-sqm-label">Базовая стоимость СИП + свайный фундамент</div>\n' +
    '    <div class="price-sqm-value">' + pricePerSqm + ' ₽/м²</div>\n' +
    '  </div>\n' +

    // STAGES
    '  <div class="stages-section">\n' +
    '    <div class="section-title">Предварительный расчёт стоимости</div>\n' +
    stagesHTML +
    '  </div>\n' +

    // BASE TOTAL
    '  <div class="base-total">\n' +
    '    <div class="base-total-label">Итого основное строительство:</div>\n' +
    '    <div class="base-total-value">' + stagesTotal + ' ₽</div>\n' +
    '  </div>\n' +

    // OPTIONS
    (optionsHTML ? (
      '  <div class="options-section">\n' +
      '    <div class="section-title">Отделка, коммуникации и доп. опции</div>\n' +
      '    <table class="options-table">\n' +
      '      <thead><tr><th></th><th>Наименование</th><th>Кол-во</th><th style="text-align:right">Стоимость</th></tr></thead>\n' +
      '      <tbody>' + optionsHTML + '</tbody>\n' +
      '    </table>\n' +
      '  </div>\n'
    ) : '') +

    // TOTALS
    '  <div class="totals-section">\n' +
    (proposal.optionsTotalPrice ? (
      '    <div class="total-row total-options"><div class="total-label">Итого допопции:</div><div class="total-value" style="color:#6366f1">' + optionsTotal + ' ₽</div></div>\n'
    ) : '') +
    '    <div class="total-row total-cash"><div class="total-label">Общая сумма за наличный расчёт:</div><div class="total-value">' + totalCash + ' ₽</div></div>\n' +
    (proposal.totalMortgage ? (
      '    <div class="total-row total-mortgage"><div class="total-label">По ипотеке общая сумма:</div><div class="total-value" style="color:#6366f1">' + totalMortgage + ' ₽</div></div>\n'
    ) : '') +
    '  </div>\n' +

    // NOTES
    (notesHTML ? (
      '  <div class="notes-section">\n' +
      '    <div class="section-title" style="font-size:14px">Примечания</div>\n' +
      '    <ul class="notes-list">' + notesHTML + '</ul>\n' +
      '  </div>\n'
    ) : '') +

    // CTA
    '  <div class="cta-section">\n' +
    '    <p>Свяжитесь с нами для обсуждения деталей проекта, расчёта стоимости и выезда специалиста на объект!</p>\n' +
    '    <div class="cta-highlight">📞 <a href="tel:89882460202" style="color: inherit; text-decoration: none;">8 (988) 246-02-02</a></div>\n' +
    '    <div class="cta-links">\n' +
    '      <a href="https://domasmplus.ru" class="cta-link" target="_blank">🌐 Наш сайт</a>\n' +
    '      <a href="https://asmplus.bitrix24.ru/~3RN5P" class="cta-link" target="_blank">🏠 Каталог домов</a>\n' +
    '    </div>\n' +
    '    <div class="cta-address">📍 Республика Адыгея, Тургеневское шоссе, 2</div>\n' +
    '  </div>\n' +

    // FOOTER
    '  <div class="footer">\n' +
    '    <strong>ПСК «ХОРС»</strong> · Производственно-строительная компания<br>\n' +
    '    Республика Адыгея, Тургеневское шоссе, 2 · тел. <a href="tel:89882460202" style="color: rgba(255,255,255,0.7); text-decoration: none;">8 (988) 246-02-02</a><br>\n' +
    '    Данное предложение действительно 30 дней с даты формирования\n' +
    '  </div>\n' +

    '</div>\n</body>\n</html>';

  return html;
}

module.exports = { generateKPTemplate };
