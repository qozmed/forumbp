import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto'; // Native Node crypto

dotenv.config();

const app = express();
const PORT = 5001; 
const HOST = '127.0.0.1'; 
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/blackproject';

// --- SECURITY UTILS ---

// 1. Password Hashing (PBKDF2)
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, savedHash, savedSalt) => {
  const hash = crypto.pbkdf2Sync(password, savedSalt, 1000, 64, 'sha512').toString('hex');
  return hash === savedHash;
};

// 2. Rate Limiter (Basic In-Memory DDoS Protection)
// CHANGED: Increased limit to prevent issues with Admin actions + Polling
const rateLimitMap = new Map();
const rateLimiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes (reduced window)
  const maxReq = 1000; // Increased to 1000 requests per window

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
        // Just warn in console for now, maybe don't hard block for dev ease
        console.warn(`[RateLimit] IP ${ip} exceeded limit.`);
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
      }
    }
  }
  next();
};

// 3. Input Sanitization (Basic NoSQL Injection Protection)
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (typeof obj[key] === 'string') {
          // Remove common MongoDB operators from input
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

// --- MIDDLEWARE ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' })); 
app.use(rateLimiter);
app.use(sanitizeInput);

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// --- LOGGING ---
app.use((req, res, next) => {
  if (req.url.includes('/health')) return next();
  console.log(`📡 [${new Date().toISOString().split('T')[1].split('.')[0]}] ${req.method} ${req.url}`);
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
  hash: { type: String, select: false }, // Renamed from password
  salt: { type: String, select: false }, // New field
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
  notifications: { type: Array, default: [] }
}, BaseOpts));

const Category = mongoose.model('Category', new mongoose.Schema({
  id: { type: String, unique: true },
  title: String,
  backgroundUrl: String,
  order: { type: Number, default: 0 } // ADDED ORDER
}, BaseOpts));

const Forum = mongoose.model('Forum', new mongoose.Schema({
  id: { type: String, unique: true },
  categoryId: String,
  parentId: String,
  name: String,
  description: String,
  icon: String,
  isClosed: { type: Boolean, default: false }, // ADDED: Forum Closed Status
  threadCount: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  order: { type: Number, default: 0 }, // ADDED ORDER
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
  lastPost: Object
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
  isDefault: { type: Boolean, default: false }, // ADDED: Default Role
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
  const exists = await User.findOne({ $or: [{ username }, { email }] });
  if (exists) return res.status(400).json({ error: 'User already exists' });

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=256&bold=true`;
  
  // Secure Password Handling
  const { salt, hash } = hashPassword(password);

  // Determine Default Role
  const defaultRole = await Role.findOne({ isDefault: true });
  const roleId = defaultRole ? defaultRole.id : 'role_user';

  const newUser = await User.create({
    id: `u${Date.now()}`,
    username,
    email,
    hash, // Store hash
    salt, // Store salt
    avatarUrl,
    roleId, // Use determined default role
    joinedAt: new Date().toISOString()
  });

  const u = newUser.toObject();
  delete u.hash;
  delete u.salt;
  res.status(201).json(u);
}));

app.post('/api/auth/login', handle(async (req, res) => {
  const { username, password } = req.body;
  
  // Select hash and salt explicitly as they are hidden by default
  const user = await User.findOne({ username }).select('+hash +salt');
  
  if (!user || !verifyPassword(password, user.hash, user.salt)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const u = user.toObject();
  delete u.hash;
  delete u.salt;
  res.json(u);
}));

// --- SPECIFIC HANDLERS ---
app.delete('/api/forums/:id', handle(async (req, res) => {
  const forumId = req.params.id;
  await Forum.deleteOne({ id: forumId });
  // Also delete subforums
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

// Specific handler for Roles to ensure single default
app.put('/api/roles/:id', handle(async (req, res) => {
  // If setting this role as default, unset others first
  if (req.body.isDefault) {
    await Role.updateMany({ id: { $ne: req.params.id } }, { isDefault: false });
  }
  const item = await Role.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, upsert: true });
  res.json(item);
}));

// --- GENERIC CRUD ---
const createCrud = (path, Model) => {
  app.get(`/api/${path}`, handle(async (req, res) => {
    // MODIFIED: Sort by 'order' ascending (1), then natural order
    const items = await Model.find().sort({ order: 1 });
    res.json(items);
  }));

  app.post(`/api/${path}`, handle(async (req, res) => {
    if (!req.body.id) req.body.id = `${path[0]}${Date.now()}`;
    const item = await Model.create(req.body);
    res.status(201).json(item);
  }));

  app.put(`/api/${path}/:id`, handle(async (req, res) => {
    // Prevent updating critical auth fields via generic PUT
    delete req.body.hash;
    delete req.body.salt;
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

app.listen(PORT, HOST, () => {
  console.log(`
  ===========================================
  🚀 SECURE SERVER RUNNING ON PORT ${PORT}
  📡 URL: http://${HOST}:${PORT}
  🏥 Health Check: http://${HOST}:${PORT}/api/health
  ===========================================
  `);
});
