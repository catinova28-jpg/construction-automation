#!/bin/bash
# ============================================
# Скрипт установки construction-automation
# Запускать на сервере Ubuntu 22.04
# ============================================

set -e

echo "🚀 Начинаю установку construction-automation..."

# 1. Обновление системы
echo "📦 Обновляю систему..."
apt-get update -y && apt-get upgrade -y

# 2. Установка Node.js 20
echo "📦 Устанавливаю Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "  Node.js: $(node -v)"
echo "  npm: $(npm -v)"

# 3. Установка PM2
echo "📦 Устанавливаю PM2..."
npm install -g pm2

# 4. Установка Chromium для Puppeteer
echo "📦 Устанавливаю Chromium и зависимости..."
apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends

# 5. Создание директорий
echo "📁 Создаю директории..."
mkdir -p /opt/construction-automation/logs
mkdir -p /opt/construction-automation/tmp
mkdir -p /opt/construction-automation/data

# 6. Установка зависимостей проекта
echo "📦 Устанавливаю зависимости проекта..."
cd /opt/construction-automation
npm install --production

# Устанавливаем Chromium для Puppeteer
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npx puppeteer browsers install chrome 2>/dev/null || true

# 7. Настройка .env
if [ ! -f .env ]; then
  echo "⚙️  Создаю .env из шаблона..."
  cp .env.example .env
  echo ""
  echo "⚠️  ВАЖНО: Отредактируйте файл /opt/construction-automation/.env"
  echo "   Добавьте TELEGRAM_BOT_TOKEN и другие ключи"
  echo "   nano /opt/construction-automation/.env"
  echo ""
fi

# 8. Настройка Puppeteer для работы от root
export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)

# Добавляем в .env если нет
if ! grep -q "PUPPETEER_EXECUTABLE_PATH" .env 2>/dev/null; then
  echo "" >> .env
  echo "# Путь к Chromium для Puppeteer" >> .env
  echo "PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)" >> .env
fi

# 9. Запуск через PM2
echo "🚀 Запускаю приложение..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "✅ Установка завершена!"
echo ""
echo "📋 Полезные команды:"
echo "  pm2 status              — статус приложения"
echo "  pm2 logs construction-bot — просмотр логов"
echo "  pm2 restart construction-bot — перезапуск"
echo "  nano /opt/construction-automation/.env — редактировать настройки"
echo ""
echo "🔧 Не забудьте настроить .env:"
echo "  nano /opt/construction-automation/.env"
echo ""
