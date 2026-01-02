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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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
      connectTimeoutMS: 3000,
      bufferMaxEntries: 0,
      bufferCommands: false
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
  isDefault: { type: Boolean, default: false, index: true },
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
    bot.onText(/\/start (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const token = match[1]; 
        if (!token) return;
        try {
            const user = await User.findOne({ connectToken: token });
            if (user) {
                user.telegramId = chatId.toString();
                user.connectToken = undefined; 
                await user.save();
                queueTelegramMessage(chatId, `✅ <b>Аккаунт успешно привязан!</b>`, { parse_mode: 'HTML' });
            } else {
                queueTelegramMessage(chatId, `❌ Неверный токен.`);
            }
        } catch (e) { console.error('Bot Error:', e); }
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

api.post('/notifications/send', handle(async (req, res) => {
    let { targetUserId, message, link } = req.body;
    message = sanitizeString(message);
    // Only fetch telegramId, not the whole user
    const targetUser = await User.findOne({ id: targetUserId }).select('telegramId').lean();
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const newNotif = { id: `n${Date.now()}`, userId: targetUserId, type: 'system', message, link, isRead: false, createdAt: new Date().toISOString() };
    // Fire and forget update
    User.updateOne({ id: targetUserId }, { $push: { notifications: { $each: [newNotif], $slice: -50, $position: 0 } } }).exec();
    
    // Background Send via queue
    if (targetUser.telegramId && bot) {
        const fullLink = req.get('origin') + (link.startsWith('/') ? link : `/${link}`);
        queueTelegramMessage(targetUser.telegramId, `🔔 ${message.replace(/<[^>]*>?/gm, '')}\n\n👉 <a href="${fullLink}">Открыть</a>`, { parse_mode: 'HTML' });
    }
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
    res.json(item);
  }));
  api.delete(`/${path}/:id`, handle(async (req, res) => {
    await Model.deleteOne({ id: req.params.id });
    // Invalidate cache for static data
    if (['categories', 'forums', 'prefixes', 'roles'].includes(path)) {
      invalidateCache(path);
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
  await User.updateOne({ id: req.params.id }, { lastActiveAt: new Date().toISOString(), currentActivity: { ...req.body.activity, timestamp: new Date().toISOString() } });
  res.json({ success: true });
}));

createCrud('users', User);
createCrud('categories', Category);
createCrud('forums', Forum); 
createCrud('threads', Thread);
createCrud('posts', Post);
createCrud('prefixes', Prefix);
createCrud('roles', Role);

// 404 For API
api.use((req, res) => res.status(404).json({ error: 'API route not found' }));

// ==========================================
// STATIC & SPA
// ==========================================
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});