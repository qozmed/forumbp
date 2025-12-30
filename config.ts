export const APP_CONFIG = {
  // Включить режим MongoDB по умолчанию. 
  // Если сервер недоступен, приложение само переключится в Offline.
  USE_MONGO: true, 
  
  // CHANGED: Port 5001 to avoid conflicts with AirPlay/Windows Services
  // CHANGED: 127.0.0.1 explicitly to force IPv4
  API_URL: 'http://127.0.0.1:5001/api',

  // Список администраторов (доступ к панели по email)
  ROOT_ADMINS: [
    '',
    'dev@main.com',
    'me@myserver.com' 
  ]
};
