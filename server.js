import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto'; 
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
// SECURITY & PERFORMANCE PACKAGES
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss';
import compression from 'compression';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 10000; 
const HOST = '0.0.0.0'; 

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blackproject';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ==========================================
// SECURITY & PERFORMANCE CONFIGURATION
// ==========================================

// 1. HELMET
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 2. COMPRESSION
app.use(compression());

// 3. CORS
app.use(cors({
  origin: process.env.CLIENT_URL || '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 4. BODY PARSING
app.use(express.json({ limit: '10mb' }));

// 5. MONGO SANITIZE
app.use(mongoSanitize());

// 6. CUSTOM RATE LIMITER (Optimized)
const rateLimits = {
  general: { window: 60 * 1000, max: 5000 }, // Max performance
  auth: { window: 15 * 60 * 1000, max: 200 } 
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
      if (data.count > rule.max) {
        return res.status(429).json({ error: 'Too many requests' });
      }
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
  return xss(str, {
    whiteList: {}, 
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
};

// ==========================================
// TELEGRAM BOT
// ==========================================
let bot = null;
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
      autoIndex: true, 
      maxPoolSize: 100 // Maximized for speed
    });
    console.log('✅ [DB] Connected');
  } catch (err) {
    console.error('❌ [DB] Failed:', err.message);
  }
};
connectDB();

const BaseOpts = { versionKey: false };

// --- USER SCHEMA ---
const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  username: { type: String, required: true },
  email: { type: String, required: true, index: true },
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
  customTitle: String,
  signature: String,
  lastUsernameChange: { type: String, default: '' },
  notifications: { type: Array, default: [] },
  // OPTIMIZED: Index on lastActiveAt for fast sorting of active users
  lastActiveAt: { type: String, index: true },
  currentActivity: Object, 
  ipHistory: { type: [String], select: false },
  telegramId: { type: String, index: true },
  twoFactorEnabled: { type: Boolean, default: false },
  connectToken: { type: String, select: false, index: true },
  tempCode: { type: String, select: false },
  tempCodeExpires: { type: Date, select: false }
}, BaseOpts);
// Index for sorting users by points (Leaderboard)
UserSchema.index({ points: -1 });
const User = mongoose.model('User', UserSchema);

// --- CATEGORY SCHEMA ---
const CategorySchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  title: String,
  backgroundUrl: String,
  order: { type: Number, default: 0, index: true }
}, BaseOpts);
const Category = mongoose.model('Category', CategorySchema);

// --- FORUM SCHEMA ---
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
// Compound index for forum structure
ForumSchema.index({ categoryId: 1, order: 1 });
const Forum = mongoose.model('Forum', ForumSchema);

// --- THREAD SCHEMA ---
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
// COMPOUND INDEXES for Fast Sorting
// 1. Getting threads in a forum: Filter by forumId, Sort by Pinned, Order, Date
ThreadSchema.index({ forumId: 1, isPinned: -1, order: 1, createdAt: -1 });
// 2. Getting recent threads (Activity): Sort by date
ThreadSchema.index({ createdAt: -1 });
const Thread = mongoose.model('Thread', ThreadSchema);

// --- POST SCHEMA ---
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
// Compound Index: Get posts for a thread, sorted by number
PostSchema.index({ threadId: 1, number: 1 });
// Compound Index: Get user's posts sorted by date
PostSchema.index({ authorId: 1, createdAt: -1 });
const Post = mongoose.model('Post', PostSchema);

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
    res.status(500).json({ error: 'Internal Server Error' }); 
  }
};

// Cache Middleware for Static-like Data (60 seconds)
const cacheControl = (seconds = 60) => (req, res, next) => {
    if (req.method === 'GET') {
        res.set('Cache-Control', `public, max-age=${seconds}`);
    }
    next();
};

// ==========================================
// ROUTES
// ==========================================

app.post('/api/auth/register', limitReq('auth'), handle(async (req, res) => {
  let { username, email, password } = req.body;
  const ip = getClientIp(req);
  username = sanitizeString(username);
  email = sanitizeString(email);

  if (!username || !email || !password) return res.status(400).json({error: 'Fields required'});

  const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (exists) return res.status(400).json({ error: 'User already exists' });

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=256&bold=true`;
  const { salt, hash } = hashPassword(password);
  const defaultRole = await Role.findOne({ isDefault: true }).lean();
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

  // OPTIMIZATION: Use lean() to avoid hydrating heavy Mongoose object
  const user = await User.findOne({ email }).select('+hash +salt +ipHistory +telegramId +twoFactorEnabled +tempCode +tempCodeExpires').lean();
  
  if (!user || !user.salt || !verifyPassword(password, user.hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.isBanned) return res.status(403).json({ error: 'User is banned' });

  // 2FA Check
  if (user.twoFactorEnabled && user.telegramId && bot) {
      const now = new Date();
      let code = user.tempCode;
      
      // Reuse existing code if valid (prevents spam and DB writes)
      const isCodeValid = code && user.tempCodeExpires && new Date(user.tempCodeExpires) > now;

      if (!isCodeValid) {
          code = generateCode();
          // FAST UPDATE: Use atomic update instead of full save
          await User.updateOne(
              { id: user.id }, 
              { 
                  tempCode: code, 
                  tempCodeExpires: new Date(Date.now() + 5 * 60 * 1000) 
              }
          );
      }

      // ASYNC TELEGRAM: Don't await the bot message. Send response immediately.
      // This is the key fix for "slow login".
      bot.sendMessage(user.telegramId, `🔐 <b>Код:</b> <code>${code}</code>`, { parse_mode: 'HTML' })
         .catch(e => console.error("TG Send Error (Background):", e.message));

      return res.status(200).json({ require2fa: true, userId: user.id });
  }

  // LOG HISTORY (ASYNC): Update IP without waiting
  User.updateOne(
      { id: user.id }, 
      { $push: { ipHistory: { $each: [ip], $slice: -20, $position: 0 } } } 
  ).exec();
  
  // Clean user object for response
  const u = { ...user };
  delete u.hash; delete u.salt; delete u.ipHistory; 
  delete u.tempCode; delete u.tempCodeExpires; delete u.connectToken;
  
  res.json(u);
}));

app.post('/api/auth/verify-2fa', limitReq('auth'), handle(async (req, res) => {
    const { userId, code } = req.body;
    const ip = getClientIp(req);

    const user = await User.findOne({ id: userId }).select('+tempCode +tempCodeExpires').lean();
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (!user.tempCode || String(user.tempCode) !== String(code)) {
        return res.status(400).json({ error: 'Invalid code' });
    }

    if (new Date() > new Date(user.tempCodeExpires)) {
        return res.status(400).json({ error: 'Code expired' });
    }

    // ATOMIC UPDATE: Clear code and update IP
    await User.updateOne(
        { id: userId },
        { 
            $unset: { tempCode: "", tempCodeExpires: "" },
            $push: { ipHistory: { $each: [ip], $slice: -20, $position: 0 } }
        }
    );

    // Re-fetch clean user for frontend state
    const cleanUser = await User.findOne({ id: userId }).lean();
    res.json(cleanUser);
}));

app.post('/api/user/telegram-link', handle(async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const token = crypto.randomBytes(16).toString('hex');
    const user = await User.findOneAndUpdate(
        { id: userId }, 
        { connectToken: token },
        { new: true }
    ).lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    const botName = 'BlackProjectRobot'; 
    const link = `https://t.me/${botName}?start=${token}`;
    res.json({ link });
}));

app.post('/api/notifications/send', handle(async (req, res) => {
    let { targetUserId, message, link } = req.body;
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
    
    // ATOMIC PUSH
    User.updateOne(
        { id: targetUserId },
        { $push: { notifications: { $each: [newNotif], $slice: -50, $position: 0 } } }
    ).exec();
    
    if (targetUser.telegramId && bot) {
        const cleanMsg = message.replace(/<[^>]*>?/gm, ''); 
        const fullLink = req.get('origin') + (link.startsWith('/') ? link : `/${link}`);
        const msg = `🔔 <b>Новое уведомление</b>\n\n${cleanMsg}\n\n👉 <a href="${fullLink}">Открыть</a>`;
        bot.sendMessage(targetUser.telegramId, msg, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(err => console.error("Tg send err", err.message));
    }

    res.json({ success: true });
}));

app.post('/api/admin/broadcast', handle(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required' });

    const usersWithTg = await User.find({ telegramId: { $exists: true, $ne: null } }).lean();
    let sentCount = 0;

    const cleanText = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "");

    // Async broadcast loop
    usersWithTg.forEach(u => {
        bot.sendMessage(u.telegramId, `📢 <b>Новости проекта</b>\n\n${cleanText}`, { parse_mode: 'HTML' }).catch(() => {});
        sentCount++;
    });

    res.json({ sent: sentCount, total: usersWithTg.length });
}));

// SUPER OPTIMIZED USER LIST
// Cached for 15s to prevent database hammering on polls
app.get('/api/users', cacheControl(15), handle(async (req, res) => {
  // Only return users who have signed up recently OR are top posters OR were active recently.
  // Limiting to 500 to prevent packet bloat.
  const users = await User.find()
    .sort({ lastActiveAt: -1 })
    .limit(500)
    .select('id username avatarUrl roleId secondaryRoleId isBanned points reactions messages customTitle joinedAt lastActiveAt currentActivity')
    .lean();
  res.json(users);
}));

app.get('/api/users/:id/sync', handle(async (req, res) => {
  const user = await User.findOne({ id: req.params.id }).select('+telegramId +twoFactorEnabled +email').lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

app.get('/api/forums', cacheControl(60), handle(async (req, res) => {
  const forums = await Forum.find().sort({ order: 1 }).lean();
  res.json(forums);
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/threads/:id', handle(async (req, res) => {
  const thread = await Thread.findOne({ id: req.params.id }).lean();
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json(thread);
}));

app.get('/api/threads', handle(async (req, res) => {
  const { forumId, limit, sort } = req.query;
  
  let query = Thread.find();
  if (forumId) {
      // Use the compound index: forumId + isPinned + order + createdAt
      query = query.where({ forumId }).sort({ isPinned: -1, order: 1, createdAt: -1 });
  } else if (sort === 'recent') {
      query = query.sort({ createdAt: -1 });
  } else {
      query = query.sort({ isPinned: -1, order: 1, createdAt: -1 });
  }
  
  if (limit) query = query.limit(parseInt(limit));
  
  // Use lean() for performance
  const items = await query.lean().exec();
  res.json(items);
}));

app.get('/api/posts', handle(async (req, res) => {
  const { threadId, userId } = req.query;
  let query = Post.find();
  
  // Optimized queries using compound indexes
  if (threadId) query = query.where({ threadId }).sort({ number: 1 }); 
  else if (userId) query = query.where({ authorId: userId }).sort({ createdAt: -1 }); 
  else query = query.limit(100); 
  
  const items = await query.lean().exec();
  res.json(items);
}));

// Caching static data types
app.get('/api/categories', cacheControl(120), handle(async (req, res) => {
    const items = await Category.find().sort({ order: 1 }).lean();
    res.json(items);
}));
app.get('/api/prefixes', cacheControl(120), handle(async (req, res) => {
    const items = await Prefix.find().lean();
    res.json(items);
}));
app.get('/api/roles', cacheControl(60), handle(async (req, res) => {
    const items = await Role.find().lean();
    res.json(items);
}));

// Write operations (No Cache)
const createCrud = (path, Model) => {
  // Read ops handled above with caching
  
  app.post(`/api/${path}`, handle(async (req, res) => {
    if (!req.body.id) req.body.id = `${path[0]}${Date.now()}`;
    
    if (req.body.title) req.body.title = sanitizeString(req.body.title);
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.content) {
        req.body.content = xss(req.body.content, { 
            whiteList: {}, 
            stripIgnoreTag: false, 
            stripIgnoreTagBody: ['script']
        });
    }

    const item = await Model.create(req.body);
    res.status(201).json(item);
  }));
  app.put(`/api/${path}/:id`, handle(async (req, res) => {
    delete req.body.hash; delete req.body.salt; delete req.body.ipHistory; 
    delete req.body.tempCode; delete req.body.tempCodeExpires; delete req.body.connectToken;
    
    if (req.body.title) req.body.title = sanitizeString(req.body.title);
    if (req.body.name) req.body.name = sanitizeString(req.body.name);
    if (req.body.content) {
        req.body.content = xss(req.body.content, { 
            whiteList: {}, 
            stripIgnoreTag: false, 
            stripIgnoreTagBody: ['script'] 
        });
    }

    const item = await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true }).lean();
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
  const item = await Role.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true }).lean();
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