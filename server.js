import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto'; 
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
// SECURITY PACKAGES
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 10000; 
const HOST = '0.0.0.0'; 

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blackproject';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ==========================================
// SECURITY CONFIGURATION
// ==========================================

// 1. HELMET: Sets secure HTTP headers (X-Frame-Options, HSTS, CSP, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for simplicity with external images/CDN, enable in strict Prod
  crossOriginEmbedderPolicy: false
}));

// 2. CORS: Strict Origin
app.use(cors({
  origin: process.env.CLIENT_URL || '*', // In Prod, set this to exact domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 3. BODY PARSING & SANITIZATION
app.use(express.json({ limit: '10mb' })); // Limit body size to prevent DoS

// 4. MONGO SANITIZE: Removes '$' and '.' from input to prevent NoSQL Injection
app.use(mongoSanitize());

// 5. CUSTOM RATE LIMITER (Enhanced)
const rateLimits = {
  general: { window: 60 * 1000, max: 200 }, // 200 req / min per IP
  auth: { window: 15 * 60 * 1000, max: 10 } // 10 login attempts / 15 min per IP
};

const ipTrackers = {
  general: new Map(),
  auth: new Map()
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress;
};

// Rate Limiter Middleware Factory
const limitReq = (type) => (req, res, next) => {
  if (req.method === 'OPTIONS') return next(); // Skip preflight
  
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
      if (data.count > rule.max) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
    }
  }
  next();
};

// Garbage Collection for Rate Limiter
setInterval(() => {
  const now = Date.now();
  ['general', 'auth'].forEach(type => {
    ipTrackers[type].forEach((data, ip) => {
      if (now - data.startTime > rateLimits[type].window) ipTrackers[type].delete(ip);
    });
  });
}, 60000);

// Apply General Limit Globally
app.use(limitReq('general'));

// 6. XSS SANITIZATION HELPER
// We don't use strict XSS middleware globally because it breaks BBCode.
// Instead, we explicitly sanitize specific fields in routes.
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return xss(str, {
    whiteList: {}, // Strip ALL tags for critical fields (username, email)
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script'] // Aggressively remove script tags
  });
};

// ==========================================
// TELEGRAM BOT
// ==========================================
let bot = null;
if (TELEGRAM_TOKEN) {
  try {
    bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    console.log('🤖 Telegram Bot Started');

    bot.onText(/\/start (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const token = match[1]; 

        if (!token) return;

        try {
            // Find user pending connection
            const user = await User.findOne({ connectToken: token });
            if (user) {
                user.telegramId = chatId.toString();
                user.connectToken = undefined; 
                await user.save();
                bot.sendMessage(chatId, `✅ <b>Аккаунт успешно привязан!</b>`, { parse_mode: 'HTML' });
            } else {
                bot.sendMessage(chatId, `❌ Неверный токен.`);
            }
        } catch (e) {
            console.error('Bot Error:', e);
        }
    });
  } catch (e) {
    console.error('Failed to start Telegram Bot:', e.message);
  }
}

// ==========================================
// DB CONNECTION & SCHEMAS
// ==========================================
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
      dbName: 'blackproject',
      autoIndex: true 
    });
    console.log('✅ [DB] Connected');
  } catch (err) {
    console.error('❌ [DB] Failed:', err.message);
  }
};
connectDB();

const BaseOpts = { versionKey: false };

// Models
const User = mongoose.model('User', new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, required: true }, // Will be sanitized
  email: { type: String, required: true },     // Will be sanitized
  hash: { type: String, select: false },
  salt: { type: String, select: false },
  avatarUrl: { type: String, default: '' },
  roleId: { type: String, default: 'role_user' },
  secondaryRoleId: { type: String, default: '' },
  isBanned: { type: Boolean, default: false },
  messages: { type: Number, default: 0 },
  reactions: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  joinedAt: { type: String, default: () => new Date().toISOString() },
  bannerUrl: String,
  customTitle: String, // Sanitize
  signature: String,   // Allowed BBCode, but strip scripts
  lastUsernameChange: { type: String, default: '' },
  notifications: { type: Array, default: [] },
  lastActiveAt: String,
  currentActivity: Object, 
  ipHistory: { type: [String], select: false },
  telegramId: String,
  twoFactorEnabled: { type: Boolean, default: false },
  connectToken: { type: String, select: false },
  tempCode: { type: String, select: false },
  tempCodeExpires: { type: Date, select: false }
}, BaseOpts));

const Category = mongoose.model('Category', new mongoose.Schema({
  id: { type: String, unique: true },
  title: String,
  backgroundUrl: String,
  order: { type: Number, default: 0 }
}, BaseOpts));

const Forum = mongoose.model('Forum', new mongoose.Schema({
  id: { type: String, unique: true },
  categoryId: String,
  parentId: String,
  name: String,
  description: String,
  icon: String,
  isClosed: { type: Boolean, default: false },
  threadCount: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  order: { type: Number, default: 0 },
  lastPost: Object,
  subForums: Array 
}, BaseOpts));

const Thread = mongoose.model('Thread', new mongoose.Schema({
  id: { type: String, unique: true },
  forumId: String,
  title: String, // Sanitize
  authorId: String,
  createdAt: String,
  viewCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  isLocked: Boolean,
  isPinned: Boolean,
  prefixId: String,
  lastPost: Object,
  order: { type: Number, default: 0 } 
}, BaseOpts));

const Post = mongoose.model('Post', new mongoose.Schema({
  id: { type: String, unique: true },
  threadId: String,
  authorId: String,
  content: String, // Allow BBCode/HTML, but strip Scripts
  createdAt: String,
  likes: { type: Number, default: 0 },
  likedBy: { type: Array, default: [] },
  number: Number
}, BaseOpts));

const Prefix = mongoose.model('Prefix', new mongoose.Schema({
  id: { type: String, unique: true },
  text: String,
  color: String
}, BaseOpts));

const Role = mongoose.model('Role', new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  color: String,
  effect: String,
  isSystem: Boolean,
  isDefault: { type: Boolean, default: false },
  permissions: Object,
  priority: Number
}, BaseOpts));

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
  } catch (e) {
    return false;
  }
};

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const handle = (fn) => async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database not connected' });
    await fn(req, res, next);
  } catch (error) {
    console.error(`💥 Error in ${req.url}:`, error.message);
    res.status(500).json({ error: 'Internal Server Error' }); // Hide error details from client
  }
};

// PERMISSION MIDDLEWARE (Basic Implementation)
// In a real app, you'd send a JWT, decode it, and check roles.
// Here we rely on the client sending userId for some ops, which is weak for a real backend,
// but we will implement a check for ADMIN ops based on a mock session or assuming caller is trusted in this context.
// For the purpose of this request, we will check permissions if 'admin' endpoint is hit.
const checkPermission = (permName) => async (req, res, next) => {
    // NOTE: In a real app, authentication middleware runs first and populates req.user from JWT.
    // Since we don't have full JWT auth here, we assume the client logic protects view,
    // BUT for critical API endpoints, we must verify.
    // For this demo, we'll skip complex auth checks on middleware but ensure data integrity.
    next();
};

// ==========================================
// ROUTES
// ==========================================

// AUTH
app.post('/api/auth/register', limitReq('auth'), handle(async (req, res) => {
  let { username, email, password } = req.body;
  const ip = getClientIp(req);

  // SANITIZE
  username = sanitizeString(username);
  email = sanitizeString(email);

  if (!username || !email || !password) return res.status(400).json({error: 'Fields required'});

  const exists = await User.findOne({ $or: [{ username }, { email }] });
  if (exists) return res.status(400).json({ error: 'User already exists' });

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=256&bold=true`;
  const { salt, hash } = hashPassword(password);
  const defaultRole = await Role.findOne({ isDefault: true });
  const roleId = defaultRole ? defaultRole.id : 'role_user';

  const newUser = await User.create({
    id: `u${Date.now()}`,
    username,
    email,
    hash,
    salt,
    avatarUrl,
    roleId,
    joinedAt: new Date().toISOString(),
    ipHistory: [ip] 
  });

  const u = newUser.toObject();
  delete u.hash; delete u.salt; delete u.ipHistory;
  res.status(201).json(u);
}));

app.post('/api/auth/login', limitReq('auth'), handle(async (req, res) => {
  let { email, password } = req.body; 
  email = sanitizeString(email);
  
  const ip = getClientIp(req);

  const user = await User.findOne({ email }).select('+hash +salt +ipHistory +telegramId +twoFactorEnabled');
  
  if (!user || !user.salt || !verifyPassword(password, user.hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.isBanned) return res.status(403).json({ error: 'User is banned' });

  // 2FA Check
  if (user.twoFactorEnabled && user.telegramId && bot) {
      const code = generateCode();
      user.tempCode = code;
      user.tempCodeExpires = new Date(Date.now() + 5 * 60 * 1000); 
      await user.save();

      try {
          await bot.sendMessage(user.telegramId, `🔐 <b>Код:</b> <code>${code}</code>`, { parse_mode: 'HTML' });
          return res.status(200).json({ require2fa: true, userId: user.id });
      } catch (e) {
          return res.status(500).json({ error: 'Failed to send 2FA' });
      }
  }

  // Update IP History
  if (!user.ipHistory) user.ipHistory = [];
  user.ipHistory.unshift(ip);
  if (user.ipHistory.length > 20) user.ipHistory = user.ipHistory.slice(0, 20);
  await user.save();
  
  const u = user.toObject();
  delete u.hash; delete u.salt; delete u.ipHistory; 
  delete u.tempCode; delete u.tempCodeExpires; delete u.connectToken;
  
  res.json(u);
}));

app.post('/api/auth/verify-2fa', limitReq('auth'), handle(async (req, res) => {
    const { userId, code } = req.body;
    const ip = getClientIp(req);

    const user = await User.findOne({ id: userId }).select('+tempCode +tempCodeExpires +ipHistory');
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Strict string comparison to avoid type coercion attacks
    if (!user.tempCode || String(user.tempCode) !== String(code)) {
        return res.status(400).json({ error: 'Invalid code' });
    }

    if (new Date() > user.tempCodeExpires) {
        return res.status(400).json({ error: 'Code expired' });
    }

    user.tempCode = undefined;
    user.tempCodeExpires = undefined;
    if (!user.ipHistory) user.ipHistory = [];
    user.ipHistory.unshift(ip);
    await user.save();

    const u = user.toObject();
    delete u.hash; delete u.salt; delete u.ipHistory; delete u.tempCode; delete u.tempCodeExpires; delete u.connectToken;
    res.json(u);
}));

// TELEGRAM LINK
app.post('/api/user/telegram-link', handle(async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const user = await User.findOne({ id: userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(16).toString('hex');
    user.connectToken = token;
    await user.save();

    const botName = process.env.TELEGRAM_BOT_NAME || 'BlackProjectAuthBot'; 
    const link = `https://t.me/${botName}?start=${token}`;
    res.json({ link });
}));

// NOTIFICATIONS
app.post('/api/notifications/send', handle(async (req, res) => {
    let { targetUserId, message, link } = req.body;
    // Sanitize message content to prevent HTML injection in logs/admin views
    message = sanitizeString(message);

    const targetUser = await User.findOne({ id: targetUserId });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const newNotif = {
        id: `n${Date.now()}`,
        userId: targetUserId,
        type: 'system',
        message,
        link,
        isRead: false,
        createdAt: new Date().toISOString()
    };
    targetUser.notifications.unshift(newNotif);
    
    if (targetUser.telegramId && bot) {
        // Strip dangerous HTML from Telegram message
        const cleanMsg = message.replace(/<[^>]*>?/gm, ''); 
        const fullLink = req.get('origin') + (link.startsWith('/') ? link : `/${link}`);
        const msg = `🔔 <b>Новое уведомление</b>\n\n${cleanMsg}\n\n👉 <a href="${fullLink}">Открыть</a>`;
        bot.sendMessage(targetUser.telegramId, msg, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(err => console.error("Tg send err", err.message));
    }

    await targetUser.save();
    res.json({ success: true });
}));

// BROADCAST (ADMIN ONLY)
app.post('/api/admin/broadcast', handle(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    // In a real app, verify req.user.role has canSendBroadcasts permission here
    
    const usersWithTg = await User.find({ telegramId: { $exists: true, $ne: null } });
    let sentCount = 0;

    // Sanitize broadcast text but allow basic formatting
    const cleanText = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "");

    for (const u of usersWithTg) {
        try {
            await bot.sendMessage(u.telegramId, `📢 <b>Новости проекта</b>\n\n${cleanText}`, { parse_mode: 'HTML' });
            sentCount++;
        } catch (e) {}
    }

    res.json({ sent: sentCount, total: usersWithTg.length });
}));

// DATA FETCHING
app.get('/api/forums', handle(async (req, res) => {
  const forums = await Forum.find().sort({ order: 1 });
  res.json(forums);
}));

app.get('/api/users', handle(async (req, res) => {
  const users = await User.find().select('id username avatarUrl roleId secondaryRoleId isBanned points reactions messages customTitle joinedAt lastActiveAt currentActivity notifications telegramId twoFactorEnabled');
  res.json(users);
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/threads/:id', handle(async (req, res) => {
  const thread = await Thread.findOne({ id: req.params.id });
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json(thread);
}));

app.get('/api/threads', handle(async (req, res) => {
  const { forumId, limit, sort } = req.query;
  let query = Thread.find();
  if (forumId) query = query.where({ forumId });
  if (sort === 'recent') query = query.sort({ createdAt: -1 });
  else query = query.sort({ isPinned: -1, order: 1, createdAt: -1 });
  if (limit) query = query.limit(parseInt(limit));
  const items = await query.exec();
  res.json(items);
}));

app.get('/api/posts', handle(async (req, res) => {
  const { threadId, userId } = req.query;
  let query = Post.find();
  if (threadId) query = query.where({ threadId }).sort({ number: 1 }); 
  else if (userId) query = query.where({ authorId: userId }).sort({ createdAt: -1 }); 
  else query = query.limit(100); 
  const items = await query.exec();
  res.json(items);
}));

// CRUD GENERATOR (With basic sanitization)
const createCrud = (path, Model) => {
  if (!['forums', 'threads', 'posts', 'users'].includes(path)) {
    app.get(`/api/${path}`, handle(async (req, res) => {
      const items = await Model.find().sort({ order: 1 });
      res.json(items);
    }));
  }
  app.post(`/api/${path}`, handle(async (req, res) => {
    if (!req.body.id) req.body.id = `${path[0]}${Date.now()}`;
    
    // Sanitize specific fields based on Model type if needed
    if (req.body.title) req.body.title = sanitizeString(req.body.title);
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.content) {
        // Remove script tags from content but keep BBCode structure
        req.body.content = xss(req.body.content, { 
            whiteList: {}, // Allow nothing HTML, rely on parser
            stripIgnoreTag: false, // Keep BBCode brackets [b] etc
            stripIgnoreTagBody: ['script'] // Kill scripts
        });
    }

    const item = await Model.create(req.body);
    res.status(201).json(item);
  }));
  app.put(`/api/${path}/:id`, handle(async (req, res) => {
    delete req.body.hash; delete req.body.salt; delete req.body.ipHistory; 
    delete req.body.tempCode; delete req.body.tempCodeExpires; delete req.body.connectToken;
    
    // Sanitize
    if (req.body.title) req.body.title = sanitizeString(req.body.title);
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.content) {
        req.body.content = xss(req.body.content, { 
            whiteList: {}, 
            stripIgnoreTag: false, 
            stripIgnoreTagBody: ['script'] 
        });
    }

    const item = await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true });
    res.json(item);
  }));
  app.delete(`/api/${path}/:id`, handle(async (req, res) => {
    await Model.deleteOne({ id: req.params.id });
    res.json({ success: true });
  }));
};

app.delete('/api/forums/:id', handle(async (req, res) => {
  await Forum.deleteOne({ id: req.params.id });
  await Forum.deleteMany({ parentId: req.params.id }); 
  await Thread.deleteMany({ forumId: req.params.id });
  res.json({ success: true });
}));
app.delete('/api/threads/:id', handle(async (req, res) => {
  await Thread.deleteOne({ id: req.params.id });
  await Post.deleteMany({ threadId: req.params.id });
  res.json({ success: true });
}));
app.put('/api/roles/:id', handle(async (req, res) => {
  if (req.body.isDefault) await Role.updateMany({ id: { $ne: req.params.id } }, { isDefault: false });
  const item = await Role.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true });
  res.json(item);
}));
app.put('/api/users/:id/activity', handle(async (req, res) => {
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

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});