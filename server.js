import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto'; // Native Node crypto
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// RENDER CONFIGURATION
const PORT = process.env.PORT || 5001; 
const HOST = '0.0.0.0'; 

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blackproject';

// --- SECURITY UTILS ---

// 1. Password Hashing (PBKDF2)
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
    console.error("Password verification error:", e.message);
    return false;
  }
};

// 2. Advanced Rate Limiter & DDoS Protection
// Map stores: IP -> { count, startTime }
let rateLimitMap = new Map();
// Map stores: IP -> Expiry Timestamp
let blockedIPs = new Map(); 

// GARBAGE COLLECTION for DDoS Maps
// Prevents memory leaks if millions of IPs attack.
setInterval(() => {
    const now = Date.now();
    // Cleanup expired blocks
    blockedIPs.forEach((expiry, ip) => {
        if (now > expiry) blockedIPs.delete(ip);
    });
    // Cleanup old rate limit entries (older than 2 mins)
    rateLimitMap.forEach((data, ip) => {
        if (now - data.startTime > 2 * 60 * 1000) rateLimitMap.delete(ip);
    });
}, 60 * 1000); // Run every minute

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
};

const rateLimiter = (req, res, next) => {
  const ip = getClientIp(req);
  const now = Date.now();

  // 1. Check if IP is hard-blocked (DDoS mitigation)
  if (blockedIPs.has(ip)) {
    const expiry = blockedIPs.get(ip);
    if (now < expiry) {
      // FORCE DROP CONNECTION
      // Do not send a response, just destroy the socket to save resources
      return res.destroy(); 
    } else {
      blockedIPs.delete(ip); // Unban after timeout
    }
  }

  // 2. Rate Limiting Logic
  const windowMs = 1 * 60 * 1000; // 1 minute window
  const maxReq = 450; // 450 requests per minute

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
  } else {
    const data = rateLimitMap.get(ip);
    if (now - data.startTime > windowMs) {
      data.count = 1;
      data.startTime = now;
    } else {
      data.count++;
      if (data.count > maxReq) {
        console.warn(`[DDoS Detect] Blocking IP: ${ip}`);
        // Block for 10 minutes
        blockedIPs.set(ip, now + 10 * 60 * 1000);
        return res.destroy();
      }
    }
  }
  next();
};

// --- MIDDLEWARE ORDER IS CRITICAL ---

// 1. Rate Limit FIRST - Drop bad traffic before parsing JSON or checking CORS
app.use(rateLimiter);

// 2. Trust Proxy (for IP detection behind load balancers like Render)
app.set('trust proxy', true); 

// 3. CORS
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 4. JSON Parsing (with size limit)
app.use(express.json({ limit: '10mb' })); 

// 5. Input Sanitization
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/\$/g, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
};
app.use(sanitizeInput);

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    return res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// --- DB CONNECTION ---
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
      dbName: 'blackproject',
      autoIndex: true // Ensure indices are built
    });
    console.log('✅ [DB] Connected successfully');
  } catch (err) {
    console.error('❌ [DB] Connection Failed:', err.message);
  }
};
connectDB();

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [DB] MongoDB disconnected!');
});
mongoose.connection.on('reconnected', () => {
    console.log('✅ [DB] MongoDB reconnected.');
});

// --- SCHEMAS ---
const BaseOpts = { versionKey: false };

const User = mongoose.model('User', new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  username: { type: String, required: true },
  email: { type: String, required: true },
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
  notifications: { type: Array, default: [] },
  lastActiveAt: String,
  currentActivity: Object, 
  ipHistory: { type: [String], select: false }
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
  title: String,
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
  content: String,
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

const handle = (fn) => async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database not connected' });
    await fn(req, res, next);
  } catch (error) {
    console.error(`💥 Error in ${req.url}:`, error.message);
    res.status(500).json({ error: error.message });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', handle(async (req, res) => {
  const { username, email, password } = req.body;
  const ip = getClientIp(req);

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
  delete u.hash;
  delete u.salt;
  delete u.ipHistory;
  res.status(201).json(u);
}));

app.post('/api/auth/login', handle(async (req, res) => {
  const { username, password } = req.body;
  const ip = getClientIp(req);

  const user = await User.findOne({ username }).select('+hash +salt +ipHistory');
  
  if (!user || !user.salt || !verifyPassword(password, user.hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update IP History if this IP is new
  if (!user.ipHistory.includes(ip)) {
    user.ipHistory.push(ip);
    if (user.ipHistory.length > 10) user.ipHistory.shift();
    await user.save();
  }
  
  const u = user.toObject();
  delete u.hash;
  delete u.salt;
  delete u.ipHistory; 
  res.json(u);
}));

// --- SMART FORUM FETCH ---
app.get('/api/forums', handle(async (req, res) => {
  const forums = await Forum.find().sort({ order: 1 });
  const syncedForums = await Promise.all(forums.map(async (f) => {
    const realThreadCount = await Thread.countDocuments({ forumId: f.id });
    
    const threadsInForum = await Thread.find({ forumId: f.id }).select('id');
    const threadIds = threadsInForum.map(t => t.id);
    const realMessageCount = await Post.countDocuments({ threadId: { $in: threadIds } });

    const latestThread = await Thread.findOne({ forumId: f.id }).sort({ 'lastPost.createdAt': -1 });
    
    let needsUpdate = false;
    let updates = {};

    if (f.threadCount !== realThreadCount) {
       updates.threadCount = realThreadCount;
       needsUpdate = true;
    }
    if (f.messageCount !== realMessageCount) {
       updates.messageCount = realMessageCount;
       needsUpdate = true;
    }

    if (!latestThread) {
       if (f.lastPost) {
          updates.lastPost = null;
          needsUpdate = true;
       }
    } else {
       const actualLastPostTime = latestThread.lastPost ? latestThread.lastPost.createdAt : latestThread.createdAt;
       const storedLastPostTime = f.lastPost ? f.lastPost.createdAt : null;

       if (!f.lastPost || f.lastPost.threadId !== latestThread.id || storedLastPostTime !== actualLastPostTime) {
          updates.lastPost = {
             threadId: latestThread.id,
             threadTitle: latestThread.title,
             authorId: latestThread.lastPost ? latestThread.lastPost.authorId : latestThread.authorId,
             createdAt: actualLastPostTime,
             prefixId: latestThread.prefixId
          };
          needsUpdate = true;
       }
    }

    if (needsUpdate) {
       const updated = await Forum.findOneAndUpdate({ id: f.id }, updates, { new: true });
       return updated;
    }
    return f;
  }));
  res.json(syncedForums);
}));

// --- SPECIFIC HANDLERS ---
app.delete('/api/forums/:id', handle(async (req, res) => {
  const forumId = req.params.id;
  await Forum.deleteOne({ id: forumId });
  await Forum.deleteMany({ parentId: forumId }); 
  const threads = await Thread.find({ forumId });
  const threadIds = threads.map(t => t.id);
  await Thread.deleteMany({ forumId: forumId });
  if (threadIds.length > 0) {
    await Post.deleteMany({ threadId: { $in: threadIds } });
  }
  res.json({ success: true });
}));

app.delete('/api/threads/:id', handle(async (req, res) => {
  const threadId = req.params.id;
  await Thread.deleteOne({ id: threadId });
  await Post.deleteMany({ threadId: threadId });
  res.json({ success: true });
}));

app.put('/api/roles/:id', handle(async (req, res) => {
  if (req.body.isDefault) {
    await Role.updateMany({ id: { $ne: req.params.id } }, { isDefault: false });
  }
  const item = await Role.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true });
  res.json(item);
}));

app.put('/api/users/:id/activity', handle(async (req, res) => {
  const { activity } = req.body;
  const now = new Date().toISOString();
  await User.updateOne(
    { id: req.params.id }, 
    { 
      lastActiveAt: now,
      currentActivity: { ...activity, timestamp: now }
    }
  );
  res.json({ success: true });
}));

// --- GENERIC CRUD ---
const createCrud = (path, Model) => {
  if (path !== 'forums') {
    app.get(`/api/${path}`, handle(async (req, res) => {
      const items = await Model.find().sort({ order: 1 });
      res.json(items);
    }));
  }

  app.post(`/api/${path}`, handle(async (req, res) => {
    if (!req.body.id) req.body.id = `${path[0]}${Date.now()}`;
    const item = await Model.create(req.body);
    res.status(201).json(item);
  }));

  app.put(`/api/${path}/:id`, handle(async (req, res) => {
    delete req.body.hash;
    delete req.body.salt;
    delete req.body.ipHistory; 
    const item = await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true });
    res.json(item);
  }));

  app.delete(`/api/${path}/:id`, handle(async (req, res) => {
    await Model.deleteOne({ id: req.params.id });
    res.json({ success: true });
  }));
};

createCrud('users', User);
createCrud('categories', Category);
createCrud('forums', Forum); 
createCrud('threads', Thread);
createCrud('posts', Post);
createCrud('prefixes', Prefix);
createCrud('roles', Role);

// --- STATIC FILES ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 SERVER RUNNING ON PORT ${PORT}`);
});
