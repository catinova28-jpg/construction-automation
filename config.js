require('dotenv').config();

module.exports = {
  mode: process.env.MODE || 'demo',
  port: parseInt(process.env.PORT) || 3000,
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  bitrix24: {
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  notifications: {
    chatId: process.env.TELEGRAM_NOTIFY_CHAT_ID || '',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
  },
  hasNotifications() {
    return !!this.notifications.chatId;
  },
  isDemo() {
    return this.mode === 'demo' || !this.telegram.token;
  },
  hasTelegram() {
    return !!this.telegram.token;
  },
  hasBitrix() {
    return !!this.bitrix24.webhookUrl;
  },
  hasOpenAI() {
    return !!this.openai.apiKey;
  }
};
