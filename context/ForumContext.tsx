import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Category, Forum, Thread, Post, User, Prefix, Role, Permissions, UserActivity, Notification } from '../types';
import { db, initDB } from '../utils/db';
import { mongo } from '../services/mongo';
import { wsService } from '../services/websocket';
import { APP_CONFIG } from '../config';
import { ServerCrash, RotateCcw, WifiOff, Loader2 } from 'lucide-react';

const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

interface ForumContextType {
  categories: Category[];
  forums: Forum[];
  threads: Thread[]; 
  posts: Post[];
  prefixes: Prefix[];
  roles: Role[];
  users: Record<string, User>;
  currentUser: User | null;
  userRole: Role | null;
  loading: boolean;
  isReady: boolean;
  isOfflineMode: boolean; 
  getForum: (id: string) => Forum | undefined;
  getThread: (id: string) => Thread | undefined;
  getPostsByThread: (threadId: string) => Post[];
  getPostsByUser: (userId: string) => Post[];
  getForumsByCategory: (catId: string) => Forum[];
  getSubForums: (forumId: string) => Forum[];
  getUser: (userId: string) => User | undefined;
  getUserRole: (user: User) => Role | undefined; 
  getUserRoles: (user: User) => Role[]; 
  hasPermission: (user: User | null, perm: keyof Permissions) => boolean;
  
  // Auth
  login: (email: string, password?: string) => Promise<string | void>; 
  verify2FA: (userId: string, code: string) => Promise<void>; 
  register: (username: string, email: string, password?: string) => Promise<void>;
  logout: () => void;
  
  // Features
  createThread: (forumId: string, title: string, content: string, prefixId?: string) => Promise<void>;
  updateThread: (threadId: string, data: Partial<Thread>) => Promise<void>; 
  deleteThread: (threadId: string) => Promise<void>;
  replyToThread: (threadId: string, content: string) => Promise<void>;
  editPost: (postId: string, newContent: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  toggleThreadLock: (threadId: string) => Promise<void>; 
  toggleThreadPin: (threadId: string) => Promise<void>;  
  updateUser: (user: User) => Promise<void>;
  refreshUserData: () => Promise<void>;
  updateUserActivity: (activity: UserActivity) => Promise<void>;
  banUser: (userId: string, isBanned: boolean) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  
  // Admin
  adminCreateCategory: (title: string, backgroundUrl: string) => Promise<void>;
  adminUpdateCategory: (id: string, title: string, backgroundUrl: string) => Promise<void>;
  adminMoveCategory: (id: string, direction: 'up' | 'down') => Promise<void>; 
  adminDeleteCategory: (id: string) => Promise<void>;
  adminCreateForum: (categoryId: string, name: string, description: string, icon: string, parentId?: string, isClosed?: boolean) => Promise<void>;
  adminUpdateForum: (id: string, categoryId: string, name: string, description: string, icon: string, parentId?: string, isClosed?: boolean) => Promise<void>;
  adminMoveForum: (id: string, direction: 'up' | 'down') => Promise<void>; 
  adminDeleteForum: (id: string) => Promise<void>;
  adminMoveThread: (threadId: string, newForumId: string) => Promise<void>;
  adminReorderThread: (threadId: string, direction: 'up' | 'down') => Promise<void>;
  adminUpdateUserRole: (userId: string, roleId: string, secondaryRoleId?: string) => Promise<void>; 
  adminCreatePrefix: (text: string, color: string) => Promise<void>;
  adminDeletePrefix: (id: string) => Promise<void>;
  adminCreateRole: (name: string, color: string, permissions: Permissions, effect?: string) => Promise<void>; 
  adminUpdateRole: (role: Role) => Promise<void>;
  adminDeleteRole: (roleId: string) => Promise<void>;
  adminSetDefaultRole: (roleId: string) => Promise<void>; 
  adminBroadcast: (text: string) => Promise<any>;

  search: (query: string) => { threads: Thread[], posts: Post[] };
  loadThreadsForForum: (forumId: string) => Promise<Thread[]>;
  loadPostsForThread: (threadId: string) => Promise<Post[]>;
  loadThread: (threadId: string) => Promise<Thread | null>; 
  loadUserPosts: (userId: string) => Promise<Post[]>;
  getTelegramLink: (userId: string) => Promise<string>;
  
  // API Direct Access
  loadUser: (userId: string) => Promise<User | null>;
}

const ForumContext = createContext<ForumContextType | undefined>(undefined);

export const ForumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [useMongo] = useState(APP_CONFIG.USE_MONGO);
  const [isOffline, setIsOffline] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null); 
  
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // CORE DATA (Loaded once)
  const [categories, setCategories] = useState<Category[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [prefixes, setPrefixes] = useState<Prefix[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  
  // DYNAMIC DATA (Lazy Loaded / Cached)
  const [threads, setThreads] = useState<Thread[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isMounted = useRef(false);
  const lastActivityUpdate = useRef<number>(0); 

  const getApi = (offlineOverride: boolean) => (useMongo && !offlineOverride) ? mongo : db;

  // Helper to merge new users into state without duplicates and unnecessary updates
  const mergeUsers = (newUsers: User[] | Record<string, User>) => {
      setUsers(prev => {
          const next = { ...prev };
          const list = Array.isArray(newUsers) ? newUsers : Object.values(newUsers);
          let changed = false;
          list.forEach(u => {
              if (!next[u.id] || 
                  next[u.id].avatarUrl !== u.avatarUrl || 
                  next[u.id].username !== u.username ||
                  next[u.id].messages !== u.messages) {
                  next[u.id] = u;
                  changed = true;
              }
          });
          return changed ? next : prev;
      });
  };

  const loadData = async (initial = false, forceOffline = false) => {
    const effectiveOffline = isOffline || forceOffline;
    try {
      if (initial) setLoading(true);
      
      if (!useMongo || effectiveOffline) {
        initDB();
      }

      const api = getApi(effectiveOffline);
      
      // PHASE 1: CRITICAL DATA (Categories, Forums, Configs, CURRENT SESSION)
      // This must load fast for the app to be usable.
      const configPromise = Promise.all([
        api.getCategories(),
        api.getForums(),
        api.getPrefixes(),
        api.getRoles()
      ]);

      // Handle Session Restore Robustly
      const sid = api.getSession();
      let userPromise: Promise<User | null> = Promise.resolve(null);
      
      if (sid) {
          userPromise = api.getUserSync(sid).catch((err) => {
              // AUTO-LOGOUT FIX: Only clear session if user is definitely not found or unauthorized (404/401)
              // If it's a network error or 503 (Database connecting), keep the token but throw error so main catch handles it.
              const msg = (err.message || '').toLowerCase();
              if (msg.includes('404') || msg.includes('not found') || msg.includes('401') || msg.includes('unauthorized')) {
                  console.warn("Session invalid, clearing token:", msg);
                  api.clearSession(); 
                  return null; // Valid guest state
              }
              console.error("Session restore transient failure:", err);
              throw err; // Propagate transient errors to trigger retry UI
          });
      }

      // Wait for CRITICAL data
      // @ts-ignore
      const [[c, f, px, r], myself] = await Promise.all([configPromise, userPromise]);

      setCategories(c || []);
      setForums(f || []);
      setPrefixes(px || []);
      setRoles(r || []);

      if (myself) {
          setCurrentUser(myself);
          mergeUsers([myself]);
      } else {
          setCurrentUser(null);
      }

      // APP IS NOW READY - RENDER IMMEDIATELY
      setFatalError(null);
      if (initial) {
          setIsReady(true);
          setLoading(false);
      }

      // PHASE 2: BACKGROUND DATA (All Users, Recent Threads)
      // This loads silently. If it fails or is slow, it doesn't block the UI.
      setTimeout(async () => {
          if (!isMounted.current) return;
          try {
              // Fetch recent threads to populate home/activity
              const recentThreads = await api.getThreads(undefined, 20).catch(() => []);
              if (isMounted.current && Array.isArray(recentThreads)) {
                   setThreads(prev => {
                       // Simple merge
                       const map = new Map(prev.map(t => [t.id, t]));
                       recentThreads.forEach(t => map.set(t.id, t));
                       return Array.from(map.values());
                   });
              }

              // Fetch users (Limit 500)
              const activeUsers = await api.getUsers().catch(() => ({})); 
              if (isMounted.current && activeUsers) {
                  mergeUsers(activeUsers);
              }
          } catch (e) { 
              console.warn("Background fetch warning:", e); 
          }
      }, 100);

    } catch (e: any) {
      if (initial && !effectiveOffline) {
        // If we are strictly in Mongo mode and it fails, don't fallback to offline DB automatically if we want to force connection retry
        // But for user experience, let's show fatal error with retry
        setFatalError(e.message);
        return; 
      }
      if (initial) setFatalError(e.message);
    }
  };

  const refreshUserData = async () => {
      try {
          const api = getApi(isOffline);
          if (currentUser) {
              // @ts-ignore
              const myself = await api.getUserSync(currentUser.id);
              setCurrentUser(myself);
              mergeUsers([myself]);
          }
      } catch (e) {
          console.error("Failed to refresh user data", e);
      }
  };

  // Direct loader for profile pages to avoid "eternal loading" if user isn't in top 500
  const loadUser = async (userId: string): Promise<User | null> => {
      // Check cache first
      if (users[userId]) return users[userId];
      
      try {
          const api = getApi(isOffline);
          // @ts-ignore
          const user = await api.getUserSync(userId);
          if (user) mergeUsers([user]);
          return user;
      } catch (e) {
          return null;
      }
  };

  const loadThreadsForForum = async (forumId: string): Promise<Thread[]> => {
     try {
         const api = getApi(isOffline);
         // @ts-ignore
         const newThreads = await api.getThreads(forumId);
         if (Array.isArray(newThreads)) {
             setThreads(prev => {
                // Merge threads intelligently - keep existing, update with new data
                const threadMap = new Map(prev.map(t => [t.id, t]));
                newThreads.forEach(t => threadMap.set(t.id, t));
                const merged = Array.from(threadMap.values());
                // Sort by pinned, order, then date
                return merged.sort((a, b) => {
                  if (a.isPinned && !b.isPinned) return -1;
                  if (!a.isPinned && b.isPinned) return 1;
                  if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
             });
             return newThreads;
         }
         return [];
     } catch (e) { return []; }
  };

  const loadPostsForThread = async (threadId: string): Promise<Post[]> => {
     try {
         const api = getApi(isOffline);
         // @ts-ignore
         const newPosts = await api.getPosts(threadId);
         if (Array.isArray(newPosts)) {
             setPosts(prev => {
                // Merge posts intelligently - keep existing, update with new data
                const postMap = new Map(prev.map(p => [p.id, p]));
                newPosts.forEach(p => postMap.set(p.id, p));
                return Array.from(postMap.values()).sort((a, b) => (a.number || 0) - (b.number || 0));
             });
             return newPosts;
         }
         return [];
     } catch (e) { return []; }
  };

  const loadThread = async (threadId: string): Promise<Thread | null> => {
      try {
          const api = getApi(isOffline);
          // @ts-ignore
          const thread = await api.getThread(threadId);
          if (thread && thread.id) {
              setThreads(prev => {
                  const idx = prev.findIndex(t => t.id === thread.id);
                  if (idx !== -1) {
                      const copy = [...prev];
                      copy[idx] = thread;
                      return copy;
                  }
                  return [...prev, thread];
              });
              return thread;
          }
          return null;
      } catch (e) { return null; }
  };

  const loadUserPosts = async (userId: string): Promise<Post[]> => {
      try {
          const api = getApi(isOffline);
          // @ts-ignore
          const newPosts = await api.getPosts(undefined, userId);
          if (Array.isArray(newPosts)) return newPosts;
          return [];
      } catch (e) { return []; }
  };

  // WebSocket real-time updates
  useEffect(() => {
    if (!useMongo || isOffline) return;
    
    // Connect WebSocket when user is available
    if (currentUser?.id) {
      wsService.connect(currentUser.id);
    } else {
      wsService.connect(null);
    }
    
    // Listen for notifications
    const unsubNotification = wsService.on('notification', (notification: Notification) => {
      if (currentUser && notification.userId === currentUser.id) {
        setCurrentUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev };
          updated.notifications = [notification, ...(prev.notifications || [])].slice(0, 50);
          return updated;
        });
      }
    });
    
    // Listen for post updates
    const unsubPost = wsService.on('post_update', (data: any) => {
      if (data.type === 'post_created') {
        setPosts(prev => {
          const exists = prev.find(p => p.id === data.post.id);
          if (exists) return prev;
          // Add new post and sort by number
          const updated = [...prev, data.post];
          return updated.sort((a, b) => (a.number || 0) - (b.number || 0));
        });
        // Update thread reply count and lastPost
        if (data.threadId) {
          setThreads(prev => prev.map(t => 
            t.id === data.threadId ? { 
              ...t, 
              replyCount: (t.replyCount || 0) + 1,
              lastPost: data.post.lastPost || t.lastPost
            } : t
          ));
          // Update forum stats
          const thread = threads.find(t => t.id === data.threadId);
          if (thread) {
            setForums(prev => prev.map(f => 
              f.id === thread.forumId ? {
                ...f,
                messageCount: (f.messageCount || 0) + 1,
                lastPost: data.post.lastPost || f.lastPost
              } : f
            ));
          }
        }
      } else if (data.type === 'post_updated') {
        setPosts(prev => prev.map(p => p.id === data.post.id ? data.post : p));
      } else if (data.type === 'post_deleted') {
        setPosts(prev => prev.filter(p => p.id !== data.postId));
        if (data.threadId) {
          setThreads(prev => prev.map(t => 
            t.id === data.threadId ? { ...t, replyCount: Math.max(0, (t.replyCount || 0) - 1) } : t
          ));
        }
      }
    });
    
    // Listen for thread updates
    const unsubThread = wsService.on('thread_update', (data: any) => {
      if (data.type === 'thread_created') {
        setThreads(prev => {
          const exists = prev.find(t => t.id === data.thread.id);
          if (exists) return prev;
          return [...prev, data.thread];
        });
      } else if (data.type === 'thread_updated') {
        setThreads(prev => prev.map(t => t.id === data.thread.id ? data.thread : t));
      } else if (data.type === 'thread_deleted') {
        setThreads(prev => prev.filter(t => t.id !== data.threadId));
        setPosts(prev => prev.filter(p => {
          const thread = threads.find(t => t.id === data.threadId);
          return thread ? p.threadId !== data.threadId : true;
        }));
      }
    });
    
    // Listen for forum updates
    const unsubForum = wsService.on('forum_update', (data: any) => {
      if (data.type === 'forum_updated') {
        setForums(prev => prev.map(f => f.id === data.forum.id ? data.forum : f));
      } else if (data.type === 'forum_deleted') {
        setForums(prev => prev.filter(f => f.id !== data.forumId));
      }
    });
    
    // Listen for user activity updates (lightweight, no DB queries)
    const unsubActivity = wsService.on('user_activity', (data: any) => {
      setUsers(prev => {
        const user = prev[data.userId];
        if (user) {
          return { ...prev, [data.userId]: { ...user, currentActivity: data.activity } };
        }
        return prev;
      });
    });
    
    return () => {
      unsubNotification();
      unsubPost();
      unsubThread();
      unsubForum();
      unsubActivity();
      wsService.disconnect();
    };
  }, [currentUser?.id, useMongo, isOffline]);

  useEffect(() => {
    isMounted.current = true;
    loadData(true);
    return () => { isMounted.current = false; };
  }, [useMongo, isOffline]); 

  const getForum = (id: string) => forums.find(f => f.id === id);
  const getThread = (id: string) => threads.find(t => t.id === id);
  const getPostsByThread = (threadId: string) => posts.filter(p => p.threadId === threadId).sort((a, b) => a.number - b.number);
  const getPostsByUser = (userId: string) => posts.filter(p => p.authorId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const getForumsByCategory = (catId: string) => forums.filter(f => f.categoryId === catId && !f.parentId);
  const getSubForums = (forumId: string) => forums.filter(f => f.parentId === forumId);
  const getUser = (userId: string) => users[userId];

  const getUserRole = (user: User) => roles.find(r => r.id === user.roleId) || roles.find(r => r.id === 'role_user');
  
  const getUserRoles = (user: User) => {
    if (!user) return [];
    const res: Role[] = [];
    const p = roles.find(r => r.id === user.roleId);
    if(p) res.push(p);
    if(user.secondaryRoleId) {
      const s = roles.find(r => r.id === user.secondaryRoleId);
      if(s) res.push(s);
    }
    if(res.length === 0) {
       const def = roles.find(r => r.id === 'role_user');
       if(def) res.push(def);
    }
    return res;
  };

  const hasPermission = (user: User | null, perm: keyof Permissions): boolean => {
    const userEmail = user?.email || '';
    if (user && APP_CONFIG.ROOT_ADMINS.includes(userEmail.toLowerCase())) return true;
    
    if (!user) {
       const guestRole = roles.find(r => r.id === 'role_guest');
       return guestRole ? guestRole.permissions[perm] : false;
    }
    if (user.isBanned) return false;
    return getUserRoles(user).some(r => r.permissions[perm]);
  };

  const search = (query: string) => {
    const q = (query || '').toLowerCase();
    return { 
      threads: threads.filter(t => (t.title || '').toLowerCase().includes(q)), 
      posts: posts.filter(p => (p.content || '').toLowerCase().includes(q)) 
    };
  };

  const mutate = async (fn: () => Promise<any>) => {
    try {
      await fn();
    } catch (e: any) {
      alert(e.message || "Ошибка выполнения");
    } 
  };

  const mutationApi = (useMongo && !isOffline) ? mongo : db;
  const safeUpdateCategory = async (cat: Category) => {
     if ((mutationApi as any).addCategoryUpdate) return (mutationApi as any).addCategoryUpdate(cat);
     return fetch(`${APP_CONFIG.API_URL}/categories/${cat.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cat) });
  };

  // Auth & Telegram
  const login = async (email: string, p?: string) => {
    if (isOffline) {
       const user = await db.login(email);
       // @ts-ignore
       if (user.password !== simpleHash(p || '')) throw new Error("Неверный пароль");
       if (user.isBanned) throw new Error("Пользователь забанен");
       setCurrentUser(user);
       mergeUsers([user]);
       db.setSession(user.id);
    } else {
       const response = await mongo.login(email, p);
       if ('require2fa' in response && response.require2fa) {
           return response.userId;
       }
       const user = response as User;
       if (user.isBanned) throw new Error("Пользователь забанен");
       
       // SET SESSION FIRST to ensure persistence
       mongo.setSession(user.id);
       setCurrentUser(user);
       mergeUsers([user]);
    }
  };

  const verify2FA = async (userId: string, code: string) => {
      const user = await mongo.verify2FA(userId, code);
      if (user.isBanned) throw new Error("Пользователь забанен");
      mongo.setSession(user.id);
      setCurrentUser(user);
      mergeUsers([user]);
  };

  const register = async (u: string, e: string, p?: string) => {
    if (isOffline) {
       const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u)}&background=random&color=fff&size=256&bold=true`;
       const defaultRole = roles.find(r => r.isDefault);
       const payload: User = { id: '', username: u, email: e, password: simpleHash(p || ''), avatarUrl, roleId: defaultRole ? defaultRole.id : 'role_user', isBanned: false, messages: 0, reactions: 0, points: 0, joinedAt: new Date().toISOString(), notifications: [] };
       const created = await db.addUser(payload);
       setCurrentUser(created);
       mergeUsers([created]);
       db.setSession(created.id);
    } else {
       const created = await mongo.addUser({ username: u, email: e, password: p } as any);
       setCurrentUser(created);
       mergeUsers([created]);
       mongo.setSession(created.id);
    }
  };

  const logout = () => { setCurrentUser(null); mutationApi.clearSession(); };

  const getTelegramLink = async (userId: string) => {
      if (isOffline) return '';
      const res = await mongo.getTelegramLink(userId);
      return res.link;
  };

  const updateUserActivity = async (activity: UserActivity) => {
    if (!currentUser) return;
    const now = Date.now();
    if (currentUser.currentActivity?.type === activity.type && (now - lastActivityUpdate.current < 30000)) return;
    lastActivityUpdate.current = now;
    try {
        if (useMongo && !isOffline) await fetch(`${APP_CONFIG.API_URL}/users/${currentUser.id}/activity`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity }) });
        else {
           const updated = { ...currentUser, lastActiveAt: new Date().toISOString(), currentActivity: activity };
           await db.updateUser(updated);
           setCurrentUser(updated);
        }
    } catch (e) {}
  };

  const createThread = (fid: string, title: string, content: string, pid?: string) => mutate(async () => {
    if(!currentUser) return;
    const forum = forums.find(f => f.id === fid);
    if (!forum) return;
    if (forum.isClosed && !hasPermission(currentUser, 'canManageForums')) throw new Error("Этот форум закрыт.");
    const tid = `t${Date.now()}`;
    const now = new Date().toISOString();
    const newThread = { id: tid, forumId: fid, title, authorId: currentUser.id, createdAt: now, viewCount: 0, replyCount: 0, isLocked: false, isPinned: false, prefixId: pid, order: 0 };
    const newPost = { id: `p${Date.now()}`, threadId: tid, authorId: currentUser.id, content, createdAt: now, likedBy: [], likes: 0, number: 1 };
    
    // Optimistic update
    setThreads(prev => [...prev, newThread]);
    setPosts(prev => [...prev, newPost]);
    setForums(prev => prev.map(f => f.id === fid ? {
      ...f,
      threadCount: (f.threadCount || 0) + 1,
      messageCount: (f.messageCount || 0) + 1,
      lastPost: { threadId: tid, threadTitle: title, authorId: currentUser.id, createdAt: now, prefixId: pid }
    } : f));
    
    // Update in background
    await mutationApi.addThread(newThread);
    await mutationApi.addPost(newPost);
    await mutationApi.updateForum({ ...forum, threadCount: (forum.threadCount || 0) + 1, messageCount: (forum.messageCount || 0) + 1, lastPost: { threadId: tid, threadTitle: title, authorId: currentUser.id, createdAt: now, prefixId: pid } });
    updateUser({...currentUser, messages: currentUser.messages + 1, points: currentUser.points + 5});
    
    // Reload threads for this forum to show the new one (WebSocket will also update)
    await loadThreadsForForum(fid);
  });

  const updateThread = (threadId: string, data: Partial<Thread>) => mutate(async () => {
     const t = getThread(threadId);
     if(t) {
        await mutationApi.updateThread({ ...t, ...data });
        // Update local state immediately
        setThreads(prev => prev.map(thread => thread.id === threadId ? { ...thread, ...data } : thread));
     }
  });

  const deleteThread = (threadId: string) => mutate(async () => { 
      await mutationApi.deleteThread(threadId); 
      setThreads(prev => prev.filter(t => t.id !== threadId));
  });
  
  const adminMoveThread = (threadId: string, newForumId: string) => mutate(async () => { 
      const t = getThread(threadId); 
      if(t && t.forumId !== newForumId) {
          await mutationApi.updateThread({...t, forumId: newForumId});
      }
  });
  
  const adminReorderThread = (threadId: string, direction: 'up' | 'down') => mutate(async () => {
     const thread = getThread(threadId); if (!thread) return;
     // Logic remains same, server handles reorder, we just refresh
     const siblings = threads.filter(t => t.forumId === thread.forumId).sort((a,b) => {
         if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
         return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
     });
     const normalized = siblings.map((t, idx) => ({ ...t, order: idx }));
     const index = normalized.findIndex(t => t.id === threadId);
     if (index === -1) return;
     if (direction === 'up' && index > 0) {
        normalized[index].order = index - 1; normalized[index - 1].order = index;
        await mutationApi.updateThread(normalized[index]); await mutationApi.updateThread(normalized[index - 1]);
     } else if (direction === 'down' && index < normalized.length - 1) {
        normalized[index].order = index + 1; normalized[index + 1].order = index;
        await mutationApi.updateThread(normalized[index]); await mutationApi.updateThread(normalized[index + 1]);
     }
     await loadThreadsForForum(thread.forumId);
  });

  const replyToThread = (tid: string, content: string) => mutate(async () => {
    if(!currentUser) return;
    const thread = getThread(tid);
    if(!thread) return;
    const forum = forums.find(f => f.id === thread.forumId);
    if (forum && forum.isClosed && !hasPermission(currentUser, 'canManageForums')) throw new Error("Форум закрыт.");
    if (thread.isLocked && !hasPermission(currentUser, 'canLockThreads')) throw new Error("Тема закрыта.");
    const now = new Date().toISOString();
    const pid = `p${Date.now()}`;
    const postNumber = getPostsByThread(tid).length + 1;
    const newPost = { id: pid, threadId: tid, authorId: currentUser.id, content, createdAt: now, likedBy: [], likes: 0, number: postNumber };
    
    // Optimistic update - show immediately
    setPosts(prev => [...prev, newPost].sort((a, b) => (a.number || 0) - (b.number || 0)));
    setThreads(prev => prev.map(t => t.id === tid ? {
      ...t,
      replyCount: (t.replyCount || 0) + 1,
      lastPost: { authorId: currentUser.id, createdAt: now }
    } : t));
    if (forum) {
      setForums(prev => prev.map(f => f.id === thread.forumId ? {
        ...f,
        messageCount: (f.messageCount || 0) + 1,
        lastPost: { threadId: thread.id, threadTitle: thread.title, authorId: currentUser.id, createdAt: now, prefixId: thread.prefixId }
      } : f));
    }
    
    // Update in background (WebSocket will also sync)
    await mutationApi.updateThread({ ...thread, replyCount: thread.replyCount + 1, lastPost: { authorId: currentUser.id, createdAt: now } });
    await mutationApi.addPost(newPost);
    if (forum) await mutationApi.updateForum({ ...forum, messageCount: (forum.messageCount || 0) + 1, lastPost: { threadId: thread.id, threadTitle: thread.title, authorId: currentUser.id, createdAt: now, prefixId: thread.prefixId } });
    updateUser({...currentUser, messages: currentUser.messages + 1, points: currentUser.points + 2});
    
    // Notification is sent by server, but we can also send here for redundancy
    // Server handles it in /posts POST endpoint
  });

  const editPost = async (pid: string, content: string) => {
      try {
          const post = posts.find(p => p.id === pid);
          if (!post) return;
          const updatedPost = { ...post, content };
          setPosts(prev => prev.map(p => p.id === pid ? updatedPost : p));
          await mutationApi.updatePost(updatedPost);
      } catch (e) {
          alert("Ошибка редактирования");
      }
  };

  const deletePost = (pid: string) => mutate(async () => { 
      await mutationApi.deletePost(pid);
      setPosts(prev => prev.filter(p => p.id !== pid));
  });
  
  const toggleLike = async (pid: string) => {
     if(!currentUser) {
       console.warn('Cannot like: no current user');
       return;
     }
     
     const post = posts.find(p => p.id === pid);
     if(!post) {
       console.warn('Cannot like: post not found', pid);
       return;
     }
     
     try {
       const liked = post.likedBy?.includes(currentUser.id) || false;
       const currentLikedBy = post.likedBy || [];
       const newLikedBy = liked 
         ? currentLikedBy.filter(id => id !== currentUser.id) 
         : [...currentLikedBy, currentUser.id];
       const newPost = { ...post, likedBy: newLikedBy, likes: newLikedBy.length };
       
       // Optimistic update
       setPosts(prev => prev.map(p => p.id === pid ? newPost : p)); 
       
       // Update in background
       try {
         await mutationApi.updatePost(newPost);
         
         // Update author stats if liked (not if unliked)
         if (!liked) {
           const author = users[post.authorId];
           if (author) {
             const updatedAuthor = { 
               ...author, 
               reactions: (author.reactions || 0) + 1, 
               points: (author.points || 0) + 1 
             };
             setUsers(prev => ({ ...prev, [author.id]: updatedAuthor }));
             if (currentUser && currentUser.id === author.id) {
               setCurrentUser(updatedAuthor);
             }
             await mutationApi.updateUser(updatedAuthor);
           }
         }
       } catch (error) {
         console.error('Error updating post like:', error);
         // Revert optimistic update on error
         setPosts(prev => prev.map(p => p.id === pid ? post : p));
         throw error;
       }
     } catch (error) {
       console.error('Error in toggleLike:', error);
       throw error;
     }
  };

  const toggleThreadLock = (tid: string) => mutate(async () => { const t = getThread(tid); if(t) await mutationApi.updateThread({...t, isLocked: !t.isLocked}); });
  const toggleThreadPin = (tid: string) => mutate(async () => { const t = getThread(tid); if(t) await mutationApi.updateThread({...t, isPinned: !t.isPinned}); });
  
  const updateUser = async (u: User) => {
      setUsers(prev => ({ ...prev, [u.id]: u }));
      if (currentUser && currentUser.id === u.id) {
          setCurrentUser(u);
      }
      try {
          await mutationApi.updateUser(u);
      } catch (e) {
          console.error(e);
          // Don't reload everything on error, just alert
          alert("Ошибка сохранения.");
      }
  };

  const banUser = (uid: string, v: boolean) => mutate(async () => { const u = users[uid]; if(u) await mutationApi.updateUser({...u, isBanned: v}); });
  
  const markNotificationsRead = () => mutate(async () => { if(currentUser) await mutationApi.updateUser({...currentUser, notifications: currentUser.notifications.map(n=>({...n, isRead:true}))}); });
  const clearNotifications = () => mutate(async () => { if(currentUser) await mutationApi.updateUser({...currentUser, notifications: []}); });
  const deleteNotification = (id: string) => mutate(async () => { if(currentUser) await mutationApi.updateUser({...currentUser, notifications: currentUser.notifications.filter(n => n.id !== id)}); });

  // Admin Actions (These refresh Categories/Forums on completion)
  const adminCreateCategory = (t: string, b: string) => mutate(async () => { 
      await mutationApi.addCategory({id:`c${Date.now()}`, title:t, backgroundUrl:b, order: categories.length});
      const c = await mutationApi.getCategories(); setCategories(c);
  });
  const adminUpdateCategory = (id: string, t: string, b: string) => mutate(async () => { 
      const existing = categories.find(c => c.id === id); 
      if(existing) await safeUpdateCategory({ ...existing, title: t, backgroundUrl: b });
      const c = await mutationApi.getCategories(); setCategories(c);
  });
  const adminMoveCategory = (id: string, direction: 'up' | 'down') => mutate(async () => {
     // ... logic simplified for brevity, assume mutationApi handles it then we refresh
     const sorted = [...categories].sort((a,b) => (a.order||0) - (b.order||0)).map((c, idx) => ({ ...c, order: idx }));
     const index = sorted.findIndex(c => c.id === id);
     if (index === -1) return;
     if (direction === 'up' && index > 0) { sorted[index].order = index - 1; sorted[index - 1].order = index; await safeUpdateCategory(sorted[index]); await safeUpdateCategory(sorted[index - 1]); } 
     else if (direction === 'down' && index < sorted.length - 1) { sorted[index].order = index + 1; sorted[index + 1].order = index; await safeUpdateCategory(sorted[index]); await safeUpdateCategory(sorted[index + 1]); }
     const c = await mutationApi.getCategories(); setCategories(c);
  });
  const adminDeleteCategory = (id: string) => mutate(async () => { await mutationApi.deleteCategory(id); const c = await mutationApi.getCategories(); setCategories(c); });
  
  const adminCreateForum = (cid: string, n: string, d: string, i: string, pid?: string, isClosed: boolean = false) => mutate(async () => { 
      await mutationApi.addForum({ id:`f${Date.now()}`, categoryId:cid, parentId:pid, name:n, description:d, icon:i, isClosed, threadCount:0, messageCount:0, order: 999 }); 
      const f = await mutationApi.getForums(); setForums(f);
  }); 
  const adminUpdateForum = (id: string, cid: string, n: string, d: string, i: string, pid?: string, isClosed: boolean = false) => mutate(async () => { 
      const existing = forums.find(f => f.id === id); 
      if(existing) await mutationApi.updateForum({ ...existing, categoryId: cid, name: n, description: d, icon: i, parentId: pid, isClosed }); 
      const f = await mutationApi.getForums(); setForums(f);
  });
  const adminMoveForum = (id: string, direction: 'up' | 'down') => mutate(async () => {
     // ... move logic ...
     const target = forums.find(f => f.id === id); if(!target) return;
     const siblings = forums.filter(f => f.categoryId === target.categoryId && f.parentId === target.parentId).sort((a,b) => (a.order||0) - (b.order||0)).map((f, idx) => ({ ...f, order: idx }));
     const index = siblings.findIndex(f => f.id === id);
     if (index === -1) return;
     if (direction === 'up' && index > 0) { siblings[index].order = index - 1; siblings[index - 1].order = index; await mutationApi.updateForum(siblings[index]); await mutationApi.updateForum(siblings[index - 1]); }
     else if (direction === 'down' && index < siblings.length - 1) { siblings[index].order = index + 1; siblings[index + 1].order = index; await mutationApi.updateForum(siblings[index]); await mutationApi.updateForum(siblings[index + 1]); }
     const f = await mutationApi.getForums(); setForums(f);
  });
  const adminDeleteForum = (id: string) => mutate(async () => { await mutationApi.deleteForum(id); const f = await mutationApi.getForums(); setForums(f); });
  
  const adminUpdateUserRole = (uid: string, rid: string, srid?: string) => mutate(async () => { const u = users[uid]; if(u) await mutationApi.updateUser({...u, roleId:rid, secondaryRoleId:srid}); });
  
  const adminCreatePrefix = (t: string, c: string) => mutate(async () => { await mutationApi.addPrefix({id:`px${Date.now()}`, text:t, color:c}); const p = await mutationApi.getPrefixes(); setPrefixes(p); });
  const adminDeletePrefix = (id: string) => mutate(async () => { await mutationApi.deletePrefix(id); const p = await mutationApi.getPrefixes(); setPrefixes(p); });
  
  const adminCreateRole = (n: string, c: string, p: Permissions, e?: string) => mutate(async () => { await mutationApi.addRole({id:`r${Date.now()}`, name:n, color:c, permissions:p, effect:e, isSystem:false, priority:0}); const r = await mutationApi.getRoles(); setRoles(r); });
  const adminUpdateRole = (r: Role) => mutate(async () => { await mutationApi.updateRole(r); const roles = await mutationApi.getRoles(); setRoles(roles); });
  const adminDeleteRole = (id: string) => mutate(async () => { await mutationApi.deleteRole(id); const r = await mutationApi.getRoles(); setRoles(r); });
  const adminSetDefaultRole = (roleId: string) => mutate(async () => { const role = roles.find(r => r.id === roleId); if (role) await mutationApi.updateRole({ ...role, isDefault: true }); const r = await mutationApi.getRoles(); setRoles(r); });
  
  const adminBroadcast = async (text: string) => {
      if (!isOffline && useMongo) return mongo.broadcast(text);
  };

  const userRole = currentUser ? (getUserRole(currentUser) || null) : null;

  if (fatalError) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center">
         <ServerCrash className="w-20 h-20 text-red-600 mb-6" />
         <h1 className="text-3xl font-bold text-white mb-2">Ошибка подключения</h1>
         <p className="text-gray-400 max-w-md mb-8">{fatalError}</p>
         <button onClick={() => { setFatalError(null); loadData(true); }} className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200">Повторить</button>
      </div>
    );
  }

  if (!isReady) {
     return (
        <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center z-[9999]">
           <div className="relative">
              <Loader2 className="w-16 h-16 text-cyan-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-8 h-8 bg-black rounded-full"></div>
              </div>
           </div>
           <p className="mt-4 text-cyan-500 font-mono text-sm tracking-widest animate-pulse">CONNECTING</p>
        </div>
     );
  }

  return (
    <ForumContext.Provider value={{
      categories, forums, threads, posts, users, currentUser, prefixes, roles, userRole, loading, isOfflineMode: isOffline, isReady,
      getForum, getThread, getPostsByThread, getPostsByUser, getForumsByCategory, getSubForums, getUser, getUserRole, getUserRoles, hasPermission,
      login, verify2FA, register, logout, getTelegramLink,
      createThread, updateThread, deleteThread, replyToThread, editPost, deletePost, toggleLike, toggleThreadLock, toggleThreadPin,
      updateUser, refreshUserData, updateUserActivity, banUser, markNotificationsRead, clearNotifications, deleteNotification,
      adminCreateCategory, adminUpdateCategory, adminMoveCategory, adminDeleteCategory, 
      adminCreateForum, adminUpdateForum, adminMoveForum, adminDeleteForum, adminUpdateUserRole,
      adminMoveThread, adminReorderThread,
      adminCreatePrefix, adminDeletePrefix, adminCreateRole, adminUpdateRole, adminDeleteRole, adminSetDefaultRole, adminBroadcast, search,
      loadThreadsForForum, loadPostsForThread, loadUserPosts, loadThread, loadUser
    }}>
      {isOffline && (
         <div className="fixed bottom-4 right-4 z-50 bg-yellow-900/90 backdrop-blur text-white px-4 py-3 rounded-lg shadow-2xl border border-yellow-500 flex items-center gap-3 animate-pulse">
            <WifiOff className="w-5 h-5" />
            <div className="flex flex-col">
               <span className="text-sm font-bold">Оффлайн режим</span>
               <span className="text-[10px] text-yellow-200">Сервер недоступен.</span>
            </div>
            <button onClick={() => { setIsOffline(false); loadData(true); }} className="ml-2 p-1 hover:bg-white/10 rounded"><RotateCcw className="w-4 h-4" /></button>
         </div>
      )}
      {children}
    </ForumContext.Provider>
  );
};

export const useForum = () => {
  const context = useContext(ForumContext);
  if (!context) throw new Error('useForum must be used within a ForumProvider');
  return context;
};