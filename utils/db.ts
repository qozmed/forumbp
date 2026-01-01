import { User, Thread, Post, Forum, Category, Prefix, Role } from '../types';
import { SEED_CATEGORIES, SEED_FORUMS, SEED_PREFIXES, SEED_ROLES } from '../constants';

// This file is the "Local Storage" mock DB.
// It is used if USE_MONGO is false in config.ts.

const DB_KEYS = {
  USERS: 'bp_users',
  THREADS: 'bp_threads',
  POSTS: 'bp_posts',
  FORUMS: 'bp_forums',
  CATEGORIES: 'bp_categories',
  PREFIXES: 'bp_prefixes',
  ROLES: 'bp_roles',
  SESSION: 'bp_session'
};

const dbChannel = new BroadcastChannel('bp_forum_updates');

export const initDB = () => {
  if (!localStorage.getItem(DB_KEYS.CATEGORIES)) {
    // Add default order to seeds if missing
    const seededCats = SEED_CATEGORIES.map((c, i) => ({ ...c, order: i }));
    localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify(seededCats));
  }
  if (!localStorage.getItem(DB_KEYS.FORUMS)) {
    const seededForums = SEED_FORUMS.map((f, i) => ({ ...f, order: i }));
    localStorage.setItem(DB_KEYS.FORUMS, JSON.stringify(seededForums));
  }
  if (!localStorage.getItem(DB_KEYS.PREFIXES)) {
    localStorage.setItem(DB_KEYS.PREFIXES, JSON.stringify(SEED_PREFIXES));
  }
  const storedRolesStr = localStorage.getItem(DB_KEYS.ROLES);
  if (!storedRolesStr) {
    localStorage.setItem(DB_KEYS.ROLES, JSON.stringify(SEED_ROLES));
  }
  if (!localStorage.getItem(DB_KEYS.USERS)) {
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify({}));
  }
  if (!localStorage.getItem(DB_KEYS.THREADS)) {
    localStorage.setItem(DB_KEYS.THREADS, JSON.stringify([]));
  }
  if (!localStorage.getItem(DB_KEYS.POSTS)) {
    localStorage.setItem(DB_KEYS.POSTS, JSON.stringify([]));
  }
};

const delay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms));

const getTable = <T>(key: string): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : ((key === DB_KEYS.USERS ? {} : []) as unknown as T);
};

const setTable = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
  dbChannel.postMessage({ type: 'UPDATE', key });
};

export const db = {
  onUpdate(callback: () => void) {
    dbChannel.onmessage = () => callback();
  },

  async login(username: string, _password?: string): Promise<User> {
    await delay();
    const users = getTable<Record<string, User>>(DB_KEYS.USERS);
    const userList = Object.values(users);
    // Robust check: ensure u.username exists before lowercasing
    const user = userList.find(u => (u.username || '').toLowerCase() === (username || '').toLowerCase());
    if (!user) throw new Error('User not found');
    return user;
  },

  async getCategories(): Promise<Category[]> {
    await delay();
    const cats = getTable<Category[]>(DB_KEYS.CATEGORIES);
    return cats.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async addCategory(category: Category): Promise<void> {
    await delay();
    const categories = getTable<Category[]>(DB_KEYS.CATEGORIES);
    // Auto-assign order to end of list
    category.order = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) + 1 : 0;
    categories.push(category);
    setTable(DB_KEYS.CATEGORIES, categories);
  },

  async deleteCategory(id: string): Promise<void> {
    await delay();
    let categories = getTable<Category[]>(DB_KEYS.CATEGORIES);
    categories = categories.filter(c => c.id !== id);
    setTable(DB_KEYS.CATEGORIES, categories);
  },
  
  async getForums(): Promise<Forum[]> {
    await delay();
    const forums = getTable<Forum[]>(DB_KEYS.FORUMS);
    return forums.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  async addForum(forum: Forum): Promise<void> {
    await delay();
    const forums = getTable<Forum[]>(DB_KEYS.FORUMS);
    forum.order = forums.length > 0 ? Math.max(...forums.map(f => f.order || 0)) + 1 : 0;
    forums.push(forum);
    setTable(DB_KEYS.FORUMS, forums);
  },

  async deleteForum(id: string): Promise<void> {
    await delay();
    let forums = getTable<Forum[]>(DB_KEYS.FORUMS);
    forums = forums.filter(f => f.id !== id);
    setTable(DB_KEYS.FORUMS, forums);

    // CASCADING DELETE: Remove all threads in this forum
    let threads = getTable<Thread[]>(DB_KEYS.THREADS);
    const threadsToDelete = threads.filter(t => t.forumId === id);
    const threadIds = threadsToDelete.map(t => t.id);
    
    // Remove threads
    threads = threads.filter(t => t.forumId !== id);
    setTable(DB_KEYS.THREADS, threads);

    // Remove posts in those threads
    let posts = getTable<Post[]>(DB_KEYS.POSTS);
    posts = posts.filter(p => !threadIds.includes(p.threadId));
    setTable(DB_KEYS.POSTS, posts);
  },

  async getPrefixes(): Promise<Prefix[]> {
    await delay();
    return getTable(DB_KEYS.PREFIXES);
  },
  
  async getRoles(): Promise<Role[]> {
    await delay();
    return getTable(DB_KEYS.ROLES);
  },

  async addRole(role: Role): Promise<void> {
    await delay();
    const roles = getTable<Role[]>(DB_KEYS.ROLES);
    roles.push(role);
    setTable(DB_KEYS.ROLES, roles);
  },

  async updateRole(role: Role): Promise<void> {
    await delay();
    const roles = getTable<Role[]>(DB_KEYS.ROLES);
    
    // If setting this role as default, unset others
    if (role.isDefault) {
       roles.forEach(r => {
          if (r.id !== role.id) r.isDefault = false;
       });
    }

    const idx = roles.findIndex(r => r.id === role.id);
    if(idx !== -1) {
        roles[idx] = role;
        setTable(DB_KEYS.ROLES, roles);
    }
  },

  async deleteRole(id: string): Promise<void> {
    await delay();
    let roles = getTable<Role[]>(DB_KEYS.ROLES);
    roles = roles.filter(r => r.id !== id);
    setTable(DB_KEYS.ROLES, roles);
  },

  async addPrefix(prefix: Prefix): Promise<void> {
    await delay();
    const prefixes = getTable<Prefix[]>(DB_KEYS.PREFIXES);
    prefixes.push(prefix);
    setTable(DB_KEYS.PREFIXES, prefixes);
  },

  async deletePrefix(id: string): Promise<void> {
    await delay();
    let prefixes = getTable<Prefix[]>(DB_KEYS.PREFIXES);
    prefixes = prefixes.filter(p => p.id !== id);
    setTable(DB_KEYS.PREFIXES, prefixes);
  },
  
  async updateForum(updatedForum: Forum): Promise<void> {
    await delay();
    const forums = getTable<Forum[]>(DB_KEYS.FORUMS);
    const index = forums.findIndex(f => f.id === updatedForum.id);
    if (index !== -1) {
      forums[index] = updatedForum;
      setTable(DB_KEYS.FORUMS, forums);
    }
  },

  async addCategoryUpdate(updatedCat: Category): Promise<void> { // Helper for update
     await delay();
     const cats = getTable<Category[]>(DB_KEYS.CATEGORIES);
     const index = cats.findIndex(c => c.id === updatedCat.id);
     if (index !== -1) {
         cats[index] = updatedCat;
         setTable(DB_KEYS.CATEGORIES, cats);
     }
  },

  async getUsers(): Promise<Record<string, User>> {
    await delay();
    return getTable(DB_KEYS.USERS);
  },
  
  async addUser(user: User): Promise<User> {
    await delay();
    const users = getTable<Record<string, User>>(DB_KEYS.USERS);
    users[user.id] = user;
    setTable(DB_KEYS.USERS, users);
    return user;
  },

  async updateUser(user: User): Promise<void> {
    await delay();
    const users = getTable<Record<string, User>>(DB_KEYS.USERS);
    if (users[user.id]) {
      users[user.id] = user;
      setTable(DB_KEYS.USERS, users);
    }
  },

  // OPTIMIZED GETTERS WITH FILTERING (Offline Mode Compatibility)
  async getThreads(forumId?: string, limit?: number): Promise<Thread[]> {
    await delay();
    let threads = getTable<Thread[]>(DB_KEYS.THREADS);
    
    if (forumId) {
        threads = threads.filter(t => t.forumId === forumId);
    }
    
    // Sort logic mimicking server (Pinned -> Order -> Date)
    threads.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (limit) {
        return threads.slice(0, limit);
    }
    return threads;
  },
  
  async getThread(id: string): Promise<Thread | null> {
    await delay();
    const threads = getTable<Thread[]>(DB_KEYS.THREADS);
    return threads.find(t => t.id === id) || null;
  },
  
  async addThread(thread: Thread): Promise<void> {
    await delay();
    const threads = getTable<Thread[]>(DB_KEYS.THREADS);
    // Ensure order is set
    thread.order = threads.length > 0 ? Math.max(...threads.map(t => t.order || 0)) + 1 : 0;
    threads.push(thread);
    setTable(DB_KEYS.THREADS, threads);
  },

  async updateThread(updatedThread: Thread): Promise<void> {
    await delay();
    const threads = getTable<Thread[]>(DB_KEYS.THREADS);
    const index = threads.findIndex(t => t.id === updatedThread.id);
    if (index !== -1) {
      threads[index] = updatedThread;
      setTable(DB_KEYS.THREADS, threads);
    }
  },

  async deleteThread(id: string): Promise<void> {
    await delay();
    let threads = getTable<Thread[]>(DB_KEYS.THREADS);
    threads = threads.filter(t => t.id !== id);
    setTable(DB_KEYS.THREADS, threads);
    
    // CASCADING DELETE: Remove posts in this thread
    let posts = getTable<Post[]>(DB_KEYS.POSTS);
    posts = posts.filter(p => p.threadId !== id);
    setTable(DB_KEYS.POSTS, posts);
  },

  async getPosts(threadId?: string, userId?: string): Promise<Post[]> {
    await delay();
    let posts = getTable<Post[]>(DB_KEYS.POSTS);
    
    if (threadId) {
        posts = posts.filter(p => p.threadId === threadId).sort((a, b) => a.number - b.number);
    } else if (userId) {
        posts = posts.filter(p => p.authorId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    return posts;
  },
  
  async addPost(post: Post): Promise<void> {
    await delay();
    const posts = getTable<Post[]>(DB_KEYS.POSTS);
    posts.push(post);
    setTable(DB_KEYS.POSTS, posts);
  },

  async updatePost(updatedPost: Post): Promise<void> {
    await delay();
    const posts = getTable<Post[]>(DB_KEYS.POSTS);
    const index = posts.findIndex(p => p.id === updatedPost.id);
    if (index !== -1) {
      posts[index] = updatedPost;
      setTable(DB_KEYS.POSTS, posts);
    }
  },

  async deletePost(id: string): Promise<void> {
    await delay();
    let posts = getTable<Post[]>(DB_KEYS.POSTS);
    posts = posts.filter(p => p.id !== id);
    setTable(DB_KEYS.POSTS, posts);
  },

  getSession(): string | null {
    return localStorage.getItem(DB_KEYS.SESSION);
  },
  setSession(userId: string): void {
    localStorage.setItem(DB_KEYS.SESSION, userId);
  },
  clearSession(): void {
    localStorage.removeItem(DB_KEYS.SESSION);
  }
};

