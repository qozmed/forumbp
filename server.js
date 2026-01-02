import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto'; 
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 5001; 
const HOST = '0.0.0.0'; 

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blackproject';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());

// Rate Limiter - Optimized
const rateLimits = {
  general: { window: 60 * 1000, max: 5000 },
  auth: { window: 15 * 60 * 1000, max: 200 } 
};
const ipTrackers = { general: new Map(), auth: new Map() };

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress;
};

const limitReq = (type) => (req, res, next) => {
  if (req.method === 'OPTIONS') return next(); 
  const ip = getClientIp(req);
  const now = Date.now();
  const rule = rateLimits[type];
  const tracker = ipTrackers[type];

  if (!tracker.has(ip)) {
    tracker.set(ip, { count: 1, startTime: now });
  } else {
    const data = tracker.get(ip);
    if (now - data.startTime > rule.window) {
      data.count = 1;
      data.startTime = now;
    } else {
      data.count++;
      if (data.count > rule.max) return res.status(429).json({ error: 'Too many requests' });
    }
  }
  next();
};

setInterval(() => {
  const now = Date.now();
  ['general', 'auth'].forEach(type => {
    ipTrackers[type].forEach((data, ip) => {
      if (now - data.startTime > rateLimits[type].window) ipTrackers[type].delete(ip);
    });
  });
}, 60000);

app.use(limitReq('general'));

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return xss(str, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] });
};

// ==========================================
// DB & MODELS
// ==========================================
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
      family: 4,
      dbName: 'blackproject',
      autoIndex: false, // Disable auto-indexing for better performance
      maxPoolSize: 50,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 3000
    });
    console.log('✅ [DB] Connected');
  } catch (err) {
    console.error('❌ [DB] Failed:', err.message);
  }
};
connectDB();

const BaseOpts = { versionKey: false };

const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  username: { type: String, required: true, index: true },
  email: { type: String, required: true, index: true },
  hash: { type: String, select: false },
  salt: { type: String, select: false },
  avatarUrl: { type: String, default: '' },
  roleId: { type: String, default: 'role_user', index: true },
  secondaryRoleId: { type: String, default: '' },
  isBanned: { type: Boolean, default: false, index: true },
  messages: { type: Number, default: 0 },
  reactions: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  joinedAt: { type: String, default: () => new Date().toISOString() },
  bannerUrl: String,
  customTitle: String,
  signature: String,
  lastUsernameChange: { type: String, default: '' },
  notifications: { type: Array, default: [] },
  lastActiveAt: { type: String, index: true },
  currentActivity: Object, 
  ipHistory: { type: [String], select: false },
  telegramId: { type: String, index: true },
  twoFactorEnabled: { type: Boolean, default: false },
  connectToken: { type: String, select: false, index: true },
  tempCode: { type: String, select: false },
  tempCodeExpires: { type: Date, select: false }
}, BaseOpts);
UserSchema.index({ points: -1 });
UserSchema.index({ lastActiveAt: -1 }); // Compound index for sorting
const User = mongoose.model('User', UserSchema);

const Category = mongoose.model('Category', new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  title: String,
  backgroundUrl: String,
  order: { type: Number, default: 0, index: true }
}, BaseOpts));

const ForumSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  categoryId: { type: String, index: true },
  parentId: { type: String, index: true },
  name: String,
  description: String,
  icon: String,
  isClosed: { type: Boolean, default: false },
  threadCount: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  order: { type: Number, default: 0, index: true },
  lastPost: Object,
  subForums: Array 
}, BaseOpts);
ForumSchema.index({ categoryId: 1, order: 1 });
const Forum = mongoose.model('Forum', ForumSchema);

const ThreadSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  forumId: { type: String, index: true },
  title: String,
  authorId: { type: String, index: true },
  createdAt: { type: String, index: true },
  viewCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  isLocked: Boolean,
  isPinned: { type: Boolean, index: true },
  prefixId: String,
  lastPost: Object,
  order: { type: Number, default: 0, index: true } 
}, BaseOpts);
ThreadSchema.index({ forumId: 1, isPinned: -1, order: 1, createdAt: -1 });
ThreadSchema.index({ createdAt: -1 });
const Thread = mongoose.model('Thread', ThreadSchema);

const PostSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  threadId: { type: String, index: true },
  authorId: { type: String, index: true },
  content: String,
  createdAt: { type: String, index: true },
  likes: { type: Number, default: 0 },
  likedBy: { type: Array, default: [] },
  number: { type: Number, index: true }
}, BaseOpts);
PostSchema.index({ threadId: 1, number: 1 });
PostSchema.index({ authorId: 1, createdAt: -1 });
const Post = mongoose.model('Post', PostSchema);

const Prefix = mongoose.model('Prefix', new mongoose.Schema({
  id: { type: String, unique: true },
  text: String,
  color: String
}, BaseOpts));

const RoleSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  color: String,
  effect: String,
  isSystem: Boolean,
  isDefault: { type: Boolean, default: false },
  permissions: Object,
  priority: Number
}, BaseOpts);
RoleSchema.index({ isDefault: 1 });
const Role = mongoose.model('Role', RoleSchema);

// ==========================================
// HELPERS
// ==========================================
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, savedHash, savedSalt) => {
  if (!password || !savedHash || !savedSalt) return false;
  try {
    const hash = crypto.pbkdf2Sync(password, savedSalt, 1000, 64, 'sha512').toString('hex');
    return hash === savedHash;
  } catch (e) { return false; }
};

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const handle = (fn) => async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database not connected' });
    await fn(req, res, next);
  } catch (error) {
    console.error(`💥 Error in ${req.url}:`, error.message);
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
};

// ==========================================
// TELEGRAM BOT WITH MESSAGE QUEUE
// ==========================================
let bot = null;
const telegramQueue = [];
let isProcessingQueue = false;

const processTelegramQueue = async () => {
  if (isProcessingQueue || telegramQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (telegramQueue.length > 0) {
    const { chatId, message, options } = telegramQueue.shift();
    try {
      await bot.sendMessage(chatId, message, options);
    } catch (err) {
      console.error('Telegram send error:', err.message);
    }
    // Small delay to avoid rate limits
    if (telegramQueue.length > 0) await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  isProcessingQueue = false;
};

const queueTelegramMessage = (chatId, message, options = {}) => {
  telegramQueue.push({ chatId, message, options });
  setImmediate(processTelegramQueue);
};

if (TELEGRAM_TOKEN) {
  try {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    bot.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) return;
      console.error('Telegram Polling Error:', error.message);
    });
    console.log('🤖 Telegram Bot Started');

    // Helper function to get user by telegramId
    const getUserByTelegramId = async (telegramId) => {
      return await User.findOne({ telegramId: telegramId.toString() }).lean();
    };

    // Command: /start with token (link account)
    bot.onText(/\/start (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const token = match[1]; 
        if (!token) {
          queueTelegramMessage(chatId, `👋 <b>Добро пожаловать!</b>\n\nДля привязки аккаунта используйте ссылку из настроек форума.\n\nИспользуйте /help для списка команд.`, { parse_mode: 'HTML' });
          return;
        }
        try {
            const user = await User.findOne({ connectToken: token });
            if (user) {
                // Check if this telegramId is already linked to another account
                const existingUser = await getUserByTelegramId(chatId);
                if (existingUser && existingUser.id !== user.id) {
                  queueTelegramMessage(chatId, `⚠️ Этот Telegram аккаунт уже привязан к другому пользователю форума.`, { parse_mode: 'HTML' });
                  return;
                }

                user.telegramId = chatId.toString();
                user.connectToken = undefined; 
                await user.save();
                
                const welcomeMsg = `✅ <b>Аккаунт успешно привязан!</b>\n\n` +
                  `👤 Пользователь: <b>${user.username}</b>\n` +
                  `📧 Email: ${user.email}\n\n` +
                  `Теперь вы будете получать уведомления и коды 2FA в этом чате.\n\n` +
                  `Используйте /help для списка команд.`;
                
                queueTelegramMessage(chatId, welcomeMsg, { parse_mode: 'HTML' });
            } else {
                queueTelegramMessage(chatId, `❌ Неверный или истекший токен привязки.\n\nПолучите новую ссылку в настройках форума.`, { parse_mode: 'HTML' });
            }
        } catch (e) { 
          console.error('Bot Error:', e);
          queueTelegramMessage(chatId, `❌ Произошла ошибка при привязке аккаунта. Попробуйте позже.`, { parse_mode: 'HTML' });
        }
    });

    // Command: /start without token
    bot.onText(/^\/start$/, async (msg) => {
      const chatId = msg.chat.id;
      const user = await getUserByTelegramId(chatId);
      
      if (user) {
        const statusMsg = `👋 <b>Добро пожаловать обратно, ${user.username}!</b>\n\n` +
          `Ваш аккаунт привязан к форуму.\n` +
          `Используйте /help для списка команд.`;
        queueTelegramMessage(chatId, statusMsg, { parse_mode: 'HTML' });
      } else {
        queueTelegramMessage(chatId, `👋 <b>Добро пожаловать!</b>\n\nДля привязки аккаунта используйте ссылку из настроек форума.\n\nИспользуйте /help для списка команд.`, { parse_mode: 'HTML' });
      }
    });

    // Command: /help
    bot.onText(/^\/help$/, async (msg) => {
      const chatId = msg.chat.id;
      const user = await getUserByTelegramId(chatId);
      
      let helpMsg = `📖 <b>Список команд:</b>\n\n`;
      
      if (user) {
        helpMsg += `✅ Ваш аккаунт привязан: <b>${user.username}</b>\n\n`;
        helpMsg += `/status - Проверить статус привязки\n`;
        helpMsg += `/2fa - Управление двухфакторной аутентификацией\n`;
        helpMsg += `/unlink - Отвязать аккаунт от Telegram\n`;
      } else {
        helpMsg += `❌ Аккаунт не привязан\n\n`;
        helpMsg += `Для привязки получите ссылку в настройках форума и используйте /start [ссылка]\n`;
      }
      
      helpMsg += `\n/help - Показать это сообщение`;
      
      queueTelegramMessage(chatId, helpMsg, { parse_mode: 'HTML' });
    });

    // Command: /status
    bot.onText(/^\/status$/, async (msg) => {
      const chatId = msg.chat.id;
      const user = await getUserByTelegramId(chatId);
      
      if (user) {
        const statusMsg = `📊 <b>Статус аккаунта</b>\n\n` +
          `👤 Пользователь: <b>${user.username}</b>\n` +
          `📧 Email: ${user.email}\n` +
          `🔐 2FA: ${user.twoFactorEnabled ? '✅ Включена' : '❌ Выключена'}\n` +
          `📅 Регистрация: ${new Date(user.joinedAt).toLocaleDateString('ru-RU')}\n` +
          `💬 Сообщений: ${user.messages || 0}\n` +
          `⭐ Очки: ${user.points || 0}`;
        
        queueTelegramMessage(chatId, statusMsg, { parse_mode: 'HTML' });
      } else {
        queueTelegramMessage(chatId, `❌ Ваш Telegram аккаунт не привязан к форуму.\n\nПолучите ссылку привязки в настройках форума.`, { parse_mode: 'HTML' });
      }
    });

    // Command: /2fa
    bot.onText(/^\/2fa$/, async (msg) => {
      const chatId = msg.chat.id;
      const user = await getUserByTelegramId(chatId);
      
      if (!user) {
        queueTelegramMessage(chatId, `❌ Ваш аккаунт не привязан. Сначала привяжите аккаунт через /start [ссылка]`, { parse_mode: 'HTML' });
        return;
      }

      const status = user.twoFactorEnabled ? 'включена' : 'выключена';
      const statusEmoji = user.twoFactorEnabled ? '✅' : '❌';
      
      const faqMsg = `${statusEmoji} <b>Двухфакторная аутентификация (2FA)</b>\n\n` +
        `Текущий статус: <b>${status}</b>\n\n` +
        `Для включения/выключения 2FA перейдите в настройки форума:\n` +
        `Настройки → Безопасность и Telegram → Включить 2FA\n\n` +
        `При включенной 2FA при каждом входе на форум вам будет отправляться код подтверждения в этот чат.`;
      
      queueTelegramMessage(chatId, faqMsg, { parse_mode: 'HTML' });
    });

    // Command: /unlink
    bot.onText(/^\/unlink$/, async (msg) => {
      const chatId = msg.chat.id;
      const user = await getUserByTelegramId(chatId);
      
      if (!user) {
        queueTelegramMessage(chatId, `❌ Ваш аккаунт не привязан.`, { parse_mode: 'HTML' });
        return;
      }

      try {
        await User.updateOne({ id: user.id }, { 
          $unset: { telegramId: "", connectToken: "" },
          twoFactorEnabled: false // Disable 2FA when unlinking
        });
        
        queueTelegramMessage(chatId, `✅ Аккаунт <b>${user.username}</b> успешно отвязан от Telegram.\n\n2FA автоматически отключена.`, { parse_mode: 'HTML' });
      } catch (e) {
        console.error('Unlink error:', e);
        queueTelegramMessage(chatId, `❌ Произошла ошибка при отвязке аккаунта.`, { parse_mode: 'HTML' });
      }
    });

    // Handle unknown commands
    bot.on('message', async (msg) => {
      if (msg.text && msg.text.startsWith('/') && !msg.text.match(/^\/(start|help|status|2fa|unlink)/)) {
        const chatId = msg.chat.id;
        queueTelegramMessage(chatId, `❓ Неизвестная команда. Используйте /help для списка доступных команд.`, { parse_mode: 'HTML' });
      }
    });

  } catch (e) { console.error('Failed to start Telegram Bot:', e.message); }
}

// ==========================================
// CACHE FOR STATIC DATA
// ==========================================
const cache = {
  categories: null,
  forums: null,
  prefixes: null,
  roles: null,
  lastUpdate: { categories: 0, forums: 0, prefixes: 0, roles: 0 },
  TTL: 30000 // 30 seconds cache
};

const getCached = async (key, fetcher) => {
  const now = Date.now();
  if (cache[key] && (now - cache.lastUpdate[key]) < cache.TTL) {
    return cache[key];
  }
  const data = await fetcher();
  cache[key] = data;
  cache.lastUpdate[key] = now;
  return data;
};

const invalidateCache = (key) => {
  if (key) {
    cache[key] = null;
    cache.lastUpdate[key] = 0;
  } else {
    cache.categories = null;
    cache.forums = null;
    cache.prefixes = null;
    cache.roles = null;
    Object.keys(cache.lastUpdate).forEach(k => cache.lastUpdate[k] = 0);
  }
};

// ==========================================
// API ROUTER (Mounts at /api)
// ==========================================
const api = express.Router();
app.use('/api', api);

// --- AUTH ---
api.post('/auth/register', limitReq('auth'), handle(async (req, res) => {
  let { username, email, password } = req.body;
  const ip = getClientIp(req);
  username = sanitizeString(username);
  email = sanitizeString(email);

  if (!username || !email || !password) return res.status(400).json({error: 'Fields required'});
  const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (exists) return res.status(400).json({ error: 'User already exists' });

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=256&bold=true`;
  const { salt, hash } = hashPassword(password);
  // Use cached roles if available, otherwise fetch
  const roles = await getCached('roles', () => Role.find().lean());
  const defaultRole = roles.find(r => r.isDefault);
  const roleId = defaultRole ? defaultRole.id : 'role_user';

  const newUser = await User.create({
    id: `u${Date.now()}`,
    username, email, hash, salt, avatarUrl, roleId,
    joinedAt: new Date().toISOString(),
    ipHistory: [ip] 
  });

  const u = newUser.toObject();
  delete u.hash; delete u.salt; delete u.ipHistory;
  res.status(201).json(u);
}));

api.post('/auth/login', limitReq('auth'), handle(async (req, res) => {
  let { email, password } = req.body; 
  email = sanitizeString(email);
  const ip = getClientIp(req);

  // Fetch critical auth fields only
  const user = await User.findOne({ email }).select('+hash +salt +telegramId +twoFactorEnabled +tempCode +tempCodeExpires').lean();
  
  if (!user || !user.salt || !verifyPassword(password, user.hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.isBanned) return res.status(403).json({ error: 'User is banned' });

  // 2FA LOGIC - OPTIMIZED FOR SPEED
  if (user.twoFactorEnabled && user.telegramId && bot) {
      const now = new Date();
      let code = user.tempCode;
      const isCodeValid = code && user.tempCodeExpires && new Date(user.tempCodeExpires) > now;

      if (!isCodeValid) {
          code = generateCode();
          // NON-BLOCKING DB UPDATE: Fire and forget to not block response
          User.updateOne({ id: user.id }, { tempCode: code, tempCodeExpires: new Date(Date.now() + 5 * 60 * 1000) }).exec();
      }

      // 1. Send Response IMMEDIATELY to frontend
      res.status(200).json({ require2fa: true, userId: user.id });

      // 2. Send Telegram Message in BACKGROUND (Fire and Forget via queue)
      // This prevents the UI from waiting for Telegram API
      queueTelegramMessage(user.telegramId, `🔐 <b>Код:</b> <code>${code}</code>`, { parse_mode: 'HTML' });
      
      return;
  }

  // STANDARD LOGIN
  // Async update history (Fire and forget)
  User.updateOne({ id: user.id }, { $push: { ipHistory: { $each: [ip], $slice: -20, $position: 0 } } }).exec();
  
  const u = { ...user };
  delete u.hash; delete u.salt; delete u.ipHistory; delete u.tempCode; delete u.tempCodeExpires; delete u.connectToken;
  res.json(u);
}));

api.post('/auth/verify-2fa', limitReq('auth'), handle(async (req, res) => {
    const { userId, code } = req.body;
    const ip = getClientIp(req);
    const user = await User.findOne({ id: userId }).select('+tempCode +tempCodeExpires').lean();
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.tempCode || String(user.tempCode) !== String(code)) return res.status(400).json({ error: 'Invalid code' });
    if (new Date() > new Date(user.tempCodeExpires)) return res.status(400).json({ error: 'Code expired' });

    // Atomic update and return user in one operation
    const cleanUser = await User.findOneAndUpdate(
      { id: userId },
      { $unset: { tempCode: "", tempCodeExpires: "" }, $push: { ipHistory: { $each: [ip], $slice: -20, $position: 0 } } },
      { new: true, lean: true }
    ).select('-hash -salt -ipHistory -tempCode -tempCodeExpires -connectToken');
    
    res.json(cleanUser);
}));

// --- SYSTEM ---
api.get('/health', (req, res) => res.json({ status: 'ok' }));

// Helper function to send notifications
const sendNotification = async (targetUserId, message, link, type = 'system', origin = '') => {
  if (!targetUserId) return;
  
  try {
    const targetUser = await User.findOne({ id: targetUserId }).select('telegramId').lean();
    if (!targetUser) return;

    const sanitizedMessage = sanitizeString(message);
    const newNotif = { 
      id: `n${Date.now()}`, 
      userId: targetUserId, 
      type, 
      message: sanitizedMessage, 
      link, 
      isRead: false, 
      createdAt: new Date().toISOString() 
    };
    
    // Update user notifications
    User.updateOne({ id: targetUserId }, { $push: { notifications: { $each: [newNotif], $slice: -50, $position: 0 } } }).exec();
    
    // Send via WebSocket (real-time)
    broadcastToUser(targetUserId, { type: 'notification', notification: newNotif });
    
    // Send via Telegram
    if (targetUser.telegramId && bot) {
      const fullLink = origin + (link.startsWith('/') ? link : `/${link}`);
      queueTelegramMessage(targetUser.telegramId, `🔔 ${sanitizedMessage.replace(/<[^>]*>?/gm, '')}\n\n👉 <a href="${fullLink}">Открыть</a>`, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('Error sending notification:', err.message);
  }
};

api.post('/notifications/send', handle(async (req, res) => {
    let { targetUserId, message, link } = req.body;
    await sendNotification(targetUserId, message, link, 'system', req.get('origin') || '');
    res.json({ success: true });
}));

// --- GETTERS ---
// Optimized User Fetch: reduced payload
api.get('/users', handle(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 500); // Default 200, max 500
  const users = await User.find()
    .sort({ lastActiveAt: -1 })
    .limit(limit)
    .select('id username avatarUrl roleId secondaryRoleId isBanned points reactions messages customTitle joinedAt lastActiveAt currentActivity')
    .lean();
  res.json(users);
}));

api.get('/users/:id/sync', handle(async (req, res) => {
  const user = await User.findOne({ id: req.params.id })
    .select('id username email avatarUrl roleId secondaryRoleId isBanned messages reactions points customTitle signature bannerUrl joinedAt lastActiveAt currentActivity notifications telegramId twoFactorEnabled')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

api.get('/categories', handle(async (req, res) => {
    const items = await getCached('categories', () => Category.find().sort({ order: 1 }).lean());
    res.json(items);
}));

api.get('/forums', handle(async (req, res) => {
  const forums = await getCached('forums', () => Forum.find().sort({ order: 1 }).lean());
  res.json(forums);
}));

api.get('/prefixes', handle(async (req, res) => {
    const items = await getCached('prefixes', () => Prefix.find().lean());
    res.json(items);
}));

api.get('/roles', handle(async (req, res) => {
    const items = await getCached('roles', () => Role.find().lean());
    res.json(items);
}));

api.get('/threads', handle(async (req, res) => {
  const { forumId, limit, sort } = req.query;
  let query = Thread.find();
  if (forumId) {
    query = query.where({ forumId }).sort({ isPinned: -1, order: 1, createdAt: -1 });
  } else if (sort === 'recent') {
    query = query.sort({ createdAt: -1 });
  } else {
    query = query.sort({ isPinned: -1, order: 1, createdAt: -1 });
  }
  const limitNum = limit ? Math.min(parseInt(limit), 500) : 100; // Default 100, max 500
  query = query.limit(limitNum);
  res.json(await query.lean().exec());
}));

api.get('/threads/:id', handle(async (req, res) => {
  const thread = await Thread.findOne({ id: req.params.id }).lean();
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  
  // Increment view count (non-blocking)
  Thread.updateOne({ id: req.params.id }, { $inc: { viewCount: 1 } }).exec();
  
  res.json(thread);
}));

api.get('/posts', handle(async (req, res) => {
  const { threadId, userId, limit } = req.query;
  let query = Post.find();
  if (threadId) {
    query = query.where({ threadId }).sort({ number: 1 });
  } else if (userId) {
    query = query.where({ authorId: userId }).sort({ createdAt: -1 });
  }
  const limitNum = limit ? Math.min(parseInt(limit), 1000) : (threadId ? undefined : 100); // No limit for thread posts, 100 default for others, max 1000
  if (limitNum) query = query.limit(limitNum);
  res.json(await query.lean().exec());
}));

// --- CRUD GENERATOR (Mounted on apiRouter) ---
const createCrud = (path, Model) => {
  api.post(`/${path}`, handle(async (req, res) => {
    if (!req.body.id) req.body.id = `${path[0]}${Date.now()}`;
    if (req.body.title) req.body.title = sanitizeString(req.body.title);
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.content) req.body.content = xss(req.body.content, { whiteList: {}, stripIgnoreTag: false, stripIgnoreTagBody: ['script'] });
    const item = await Model.create(req.body);
    // Invalidate cache for static data
    if (['categories', 'forums', 'prefixes', 'roles'].includes(path)) {
      invalidateCache(path);
    }
    // Broadcast creation for real-time updates
    if (path === 'threads') {
      broadcastToAll({ type: 'thread_created', thread: item });
    }
    res.status(201).json(item);
  }));
  api.put(`/${path}/:id`, handle(async (req, res) => {
    delete req.body.hash; delete req.body.salt; delete req.body.ipHistory; 
    delete req.body.tempCode; delete req.body.tempCodeExpires; delete req.body.connectToken;
    if (req.body.title) req.body.title = sanitizeString(req.body.title);
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.content) req.body.content = xss(req.body.content, { whiteList: {}, stripIgnoreTag: false, stripIgnoreTagBody: ['script'] });
    const item = await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true }).lean();
    // Invalidate cache for static data
    if (['categories', 'forums', 'prefixes', 'roles'].includes(path)) {
      invalidateCache(path);
    }
    // Broadcast updates for real-time sync
    if (path === 'threads') {
      broadcastToAll({ type: 'thread_updated', thread: item });
    } else if (path === 'forums') {
      broadcastToAll({ type: 'forum_updated', forum: item });
    }
    res.json(item);
  }));
  api.delete(`/${path}/:id`, handle(async (req, res) => {
    await Model.deleteOne({ id: req.params.id });
    // Invalidate cache for static data
    if (['categories', 'forums', 'prefixes', 'roles'].includes(path)) {
      invalidateCache(path);
    }
    // Broadcast deletion
    if (path === 'threads') {
      broadcastToAll({ type: 'thread_deleted', threadId: req.params.id });
    } else if (path === 'forums') {
      broadcastToAll({ type: 'forum_deleted', forumId: req.params.id });
    }
    res.json({ success: true });
  }));
};

// --- CUSTOM WRITES ---
api.post('/user/telegram-link', handle(async (req, res) => {
    const { userId } = req.body;
    const token = crypto.randomBytes(16).toString('hex');
    await User.updateOne({ id: userId }, { connectToken: token });
    res.json({ link: `https://t.me/BlackProjectRobot?start=${token}` });
}));

api.post('/admin/broadcast', handle(async (req, res) => {
    const { text } = req.body;
    const usersWithTg = await User.find({ telegramId: { $exists: true, $ne: null } }).select('telegramId').lean();
    
    // Background broadcast via queue
    if (bot) {
      setImmediate(() => {
        usersWithTg.forEach(u => {
          queueTelegramMessage(u.telegramId, `📢 <b>Новости проекта</b>\n\n${text}`, { parse_mode: 'HTML' });
        });
      });
    }
    
    res.json({ sent: usersWithTg.length, total: usersWithTg.length });
}));

api.delete('/forums/:id', handle(async (req, res) => {
  await Forum.deleteOne({ id: req.params.id });
  await Forum.deleteMany({ parentId: req.params.id }); 
  await Thread.deleteMany({ forumId: req.params.id });
  res.json({ success: true });
}));

api.delete('/threads/:id', handle(async (req, res) => {
  await Thread.deleteOne({ id: req.params.id });
  await Post.deleteMany({ threadId: req.params.id });
  res.json({ success: true });
}));

api.put('/roles/:id', handle(async (req, res) => {
  if (req.body.isDefault) await Role.updateMany({ id: { $ne: req.params.id } }, { isDefault: false });
  const item = await Role.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true }).lean();
  invalidateCache('roles');
  res.json(item);
}));

api.put('/users/:id/activity', handle(async (req, res) => {
  const update = { lastActiveAt: new Date().toISOString(), currentActivity: { ...req.body.activity, timestamp: new Date().toISOString() } };
  await User.updateOne({ id: req.params.id }, update);
  
  // Broadcast activity update (lightweight, no DB query)
  broadcastToAll({ type: 'user_activity', userId: req.params.id, activity: update.currentActivity });
  
  res.json({ success: true });
}));

createCrud('users', User);
createCrud('categories', Category);
createCrud('forums', Forum); 
createCrud('threads', Thread);
createCrud('prefixes', Prefix);
createCrud('roles', Role);

// Custom Posts CRUD with notifications and real-time updates
api.post('/posts', handle(async (req, res) => {
  if (!req.body.id) req.body.id = `p${Date.now()}`;
  if (req.body.content) req.body.content = xss(req.body.content, { whiteList: {}, stripIgnoreTag: false, stripIgnoreTagBody: ['script'] });
  const post = await Post.create(req.body);
  
  // Get thread and author info for notifications
  const thread = await Thread.findOne({ id: post.threadId }).lean();
  const author = await User.findOne({ id: post.authorId }).select('username').lean();
  
  if (thread && author) {
    // Notify thread author if it's a reply (not the first post)
    if (post.number > 1 && thread.authorId !== post.authorId) {
      await sendNotification(
        thread.authorId,
        `<b>${author.username}</b> ответил в теме "${thread.title}"`,
        `/thread/${thread.id}#post-${post.id}`,
        'reply',
        req.get('origin') || ''
      );
    }
    
    // Broadcast new post to all connected clients
    broadcastToAll({ type: 'post_created', post, threadId: post.threadId });
  }
  
  res.status(201).json(post);
}));

api.put('/posts/:id', handle(async (req, res) => {
  if (req.body.content) req.body.content = xss(req.body.content, { whiteList: {}, stripIgnoreTag: false, stripIgnoreTagBody: ['script'] });
  
  // Check if likes changed
  const oldPost = await Post.findOne({ id: req.params.id }).lean();
  const newLikedBy = req.body.likedBy || oldPost?.likedBy || [];
  const oldLikedBy = oldPost?.likedBy || [];
  
  const item = await Post.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true }).lean();
  
  // If likes changed, send notification to post author
  if (oldPost && newLikedBy.length > oldLikedBy.length && oldPost.authorId) {
    const likerId = newLikedBy.find(id => !oldLikedBy.includes(id));
    if (likerId && likerId !== oldPost.authorId) {
      const liker = await User.findOne({ id: likerId }).select('username').lean();
      const thread = await Thread.findOne({ id: oldPost.threadId }).select('title').lean();
      
      if (liker && thread) {
        await sendNotification(
          oldPost.authorId,
          `<b>${liker.username}</b> поставил лайк вашему сообщению в теме "${thread.title}"`,
          `/thread/${oldPost.threadId}#post-${oldPost.id}`,
          'system',
          req.get('origin') || ''
        );
      }
    }
  }
  
  // Broadcast post update
  broadcastToAll({ type: 'post_updated', post: item, threadId: item.threadId });
  
  res.json(item);
}));

api.delete('/posts/:id', handle(async (req, res) => {
  const post = await Post.findOne({ id: req.params.id }).lean();
  await Post.deleteOne({ id: req.params.id });
  
  // Broadcast post deletion
  if (post) {
    broadcastToAll({ type: 'post_deleted', postId: req.params.id, threadId: post.threadId });
  }
  
  res.json({ success: true });
}));

// 404 For API
api.use((req, res) => res.status(404).json({ error: 'API route not found' }));

// ==========================================
// STATIC & SPA
// ==========================================
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==========================================
// WEBSOCKET SERVER FOR REAL-TIME UPDATES
// ==========================================
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map(); // userId -> Set of WebSocket connections

wss.on('connection', (ws, req) => {
  let userId = null;
  let pingInterval = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'auth' && data.userId) {
        userId = data.userId;
        if (!clients.has(userId)) {
          clients.set(userId, new Set());
        }
        clients.get(userId).add(ws);
        console.log(`[WS] User ${userId} connected`);
        
        // Send confirmation
        ws.send(JSON.stringify({ type: 'connected', userId }));
        
        // Start ping interval
        pingInterval = setInterval(() => {
          if (ws.readyState === ws.OPEN) {
            ws.ping();
          }
        }, 30000);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('[WS] Message error:', err.message);
    }
  });

  ws.on('close', () => {
    if (userId && clients.has(userId)) {
      clients.get(userId).delete(ws);
      if (clients.get(userId).size === 0) {
        clients.delete(userId);
      }
    }
    if (pingInterval) clearInterval(pingInterval);
    console.log(`[WS] User ${userId || 'unknown'} disconnected`);
  });

  ws.on('error', (error) => {
    console.error('[WS] Error:', error.message);
  });
});

// Broadcast function to send updates to specific users
const broadcastToUser = (userId, data) => {
  if (clients.has(userId)) {
    const userClients = clients.get(userId);
    const message = JSON.stringify(data);
    userClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }
};

// Broadcast to all connected clients (for public updates)
const broadcastToAll = (data) => {
  const message = JSON.stringify(data);
  clients.forEach((userClients) => {
    userClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  });
};

server.listen(PORT, HOST, () => {
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://${HOST}:${PORT}/ws`);
});