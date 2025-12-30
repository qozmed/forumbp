export const APP_CONFIG = {
  // Включить режим MongoDB по умолчанию. 
  USE_MONGO: true, 

  // ============================================
  // НАСТРОЙКА ДЕПЛОЯ (RENDER.COM)
  // ============================================
  // Поставьте true, если деплоите на Render.
  // Это переключит API на относительный путь и подготовит приложение для продакшена.
  DEPLOY_TO_RENDER: true,
  
  // Логика определения URL API
  get API_URL() {
    // Если включен режим Render или приложение собрано (PROD), используем относительный путь.
    // Vite проксирует /api локально, а Express обрабатывает его в продакшене.
    if (this.DEPLOY_TO_RENDER || (import.meta as any).env?.PROD) {
      return '/api';
    }
    // Локальная разработка
    return 'http://127.0.0.1:5001/api';
  },

  // Список администраторов (доступ к панели по email)
  ROOT_ADMINS: [
    'admin@blackproject.rp',
    'dev@main.com',
    'me@myserver.com' 
  ]
};