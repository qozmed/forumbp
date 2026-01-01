import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Category, Forum, Thread, Post, User, Prefix, Role, Permissions, Notification, UserActivity } from '../types';
import { db, initDB } from '../utils/db';
import { mongo } from '../services/mongo';
import { APP_CONFIG } from '../config';
import { ServerCrash, RotateCcw, WifiOff, Loader2 } from 'lucide-react';

// Simple client-side hash for offline mode (Not secure, but functional for simulation)
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
  threads: Thread[]; // Now acts as a Cache
  posts: Post[];     // Now acts as a Cache
  prefixes: Prefix[];
  roles: Role[];
  users: Record<string, User>;
  currentUser: User | null;
  userRole: Role | null;
  loading: boolean;
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
  login: (username: string, password?: string) => Promise<void>;
  register: (username: string, email: string, password?: string) => Promise<void>;
  logout: () => void;
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
  updateUserActivity: (activity: UserActivity) => Promise<void>;
  banUser: (userId: string, isBanned: boolean) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
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
  search: (query: string) => { threads: Thread[], posts: Post[] };
  
  // New Lazy Loaders
  loadThreadsForForum: (forumId: string) => Promise<void>;
  loadPostsForThread: (threadId: string) => Promise<void>;
  loadUserPosts: (userId: string) => Promise<void>;
}

const ForumContext = createContext<ForumContextType | undefined>(undefined);

export const ForumProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [useMongo] = useState(APP_CONFIG.USE_MONGO);
  const [isOffline, setIsOffline] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null); 
  const [loading, setLoading] = useState(true);

  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [forums, setForums] = useState<Forum[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [prefixes, setPrefixes] = useState<Prefix[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isMounted = useRef(false);
  const pollTimer = useRef<any>(null); 
  const lastActivityUpdate = useRef<number>(0); 

  const getApi = (offlineOverride: boolean) => (useMongo && !offlineOverride) ? mongo : db;

  const loadData = async (initial = false, forceOffline = false) => {
    const effectiveOffline = isOffline || forceOffline;
    
    try {
      if (useMongo && !effectiveOffline) {
        const healthy = await mongo.checkHealth();
        if (!healthy) {
           if (!isOffline) console.warn("⚠️ Server unreachable. Switching to offline mode.");
           setIsOffline(true);
           initDB();
           return loadData(false, true);
        }
      } else if (!useMongo || effectiveOffline) {
        initDB();
      }

      const api = getApi(effectiveOffline);
      // OPTIMIZATION: Only fetch global structure and Recent Activity (Limit 20)
      // DO NOT fetch all threads and posts.
      // @ts-ignore
      const [c, f, recentThreads, u, px, r] = await Promise.all([
        api.getCategories(),
        api.getForums(),
        // @ts-ignore
        api.getThreads(undefined, 20), // Fetch ONLY recent threads for sidebar/activity
        api.getUsers(),
        api.getPrefixes(),
        api.getRoles()
      ]);

      setCategories(c || []);
      setForums(f || []);
      
      // Merge recent threads into cache without overwriting active forum threads if possible
      // For now, simple set is safest, specific views will re-fetch what they need
      setThreads(prev => {
         // Create a map of existing threads
         const map = new Map(prev.map(t => [t.id, t]));
         // Update with recent data
         recentThreads?.forEach((t: Thread) => map.set(t.id, t));
         return Array.from(map.values());
      });

      setUsers(u || {});
      setPrefixes(px || []);
      setRoles(r || []);

      const sid = api.getSession();
      if(sid && u && u[sid]) setCurrentUser(u[sid]);
      else { if(sid) api.clearSession(); setCurrentUser(null); }
      setFatalError(null);

    } catch (e: any) {
      console.error("Critical Load Error:", e);
      if (initial && !effectiveOffline) {
        setIsOffline(true);
        initDB();
        return loadData(false, true);
      }
      setFatalError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- LAZY LOADERS ---
  
  const loadThreadsForForum = async (forumId: string) => {
     const api = getApi(isOffline);
     // @ts-ignore
     const newThreads = await api.getThreads(forumId);
     
     setThreads(prev => {
        // Remove old threads for this forum (optional, keeps memory low) or just upsert
        // Let's upsert to prevent flickering, but maybe clear really old ones?
        // Simple merge:
        const map = new Map(prev.map(t => [t.id, t]));
        newThreads.forEach((t: Thread) => map.set(t.id, t));
        return Array.from(map.values());
     });
  };

  const loadPostsForThread = async (threadId: string) => {
     const api = getApi(isOffline);
     // @ts-ignore
     const newPosts = await api.getPosts(threadId);
     
     setPosts(prev => {
        // Filter out posts for this thread to replace them entirely (handles deletes correctly)
        const others = prev.filter(p => p.threadId !== threadId);
        return [...others, ...newPosts];
     });
  };

  const loadUserPosts = async (userId: string) => {
     const api = getApi(isOffline);
     // @ts-ignore
     const newPosts = await api.getPosts(undefined, userId);
     setPosts(prev => {
        const map = new Map(prev.map(p => [p.id, p]));
        newPosts.forEach((p: Post) => map.set(p.id, p));
        return Array.from(map.values());
     });
  }

  // Main Loop logic
  const startPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
       if (isMounted.current) {
         await loadData(false);
         startPolling();
       }
    }, isOffline ? 3000 : 8000); // Slower polling for structure
  };

  const stopPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  };

  useEffect(() => {
    isMounted.current = true;
    const run = async () => {
      await loadData(true);
      startPolling();
    };
    run();
    return () => { 
      isMounted.current = false; 
      stopPolling();
    };
  }, [useMongo, isOffline]);

  const getForum = (id: string) => forums.find(f => f.id === id);
  const getThread = (id: string) => threads.find(t => t.id === id);
  const getPostsByThread = (threadId: string) => posts.filter(p => p.threadId === threadId).sort((a, b) => a.number - b.number);
  const getPostsByUser = (userId: string) => posts.filter(p => p.authorId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const getForumsByCategory = (catId: string) => forums.filter(f => f.categoryId === catId && !f.parentId);
  const getSubForums = (forumId: string) => forums.filter(f => f.parentId === forumId);
  const getUser = (userId: string) => users[userId];

  const getUserRole = (user: User) => {
    if (!user) return undefined;
    return roles.find(r => r.id === user.roleId) || roles.find(r => r.id === 'role_user');
  };

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
    if (user && APP_CONFIG.ROOT_ADMINS.includes(user.email.toLowerCase())) return true;
    
    if (!user) {
       const guestRole = roles.find(r => r.id === 'role_guest');
       return guestRole ? guestRole.permissions[perm] : false;
    }
    
    if (user.isBanned) return false;
    
    return getUserRoles(user).some(r => r.permissions[perm]);
  };

  const search = (query: string) => {
    const q = query.toLowerCase();
    return { 
      threads: threads.filter(t => t.title.toLowerCase().includes(q)), 
      posts: posts.filter(p => p.content.toLowerCase().includes(q)) 
    };
  };

  const mutate = async (fn: () => Promise<any>) => {
    // We don't stop polling aggressively anymore, just fire and forget the update or reload specific parts
    try {
      await fn();
      await loadData(false); 
    } catch (e: any) {
      alert(e.message || "Ошибка выполнения");
    } 
  };

  const mutationApi = (useMongo && !isOffline) ? mongo : db;
  
  const safeUpdateCategory = async (cat: Category) => {
     if ((mutationApi as any).addCategoryUpdate) return (mutationApi as any).addCategoryUpdate(cat);
     return fetch(`${APP_CONFIG.API_URL}/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat)
     });
  };

  // --- ACTIONS ---
  const login = async (u: string, p?: string) => {
    if (isOffline) {
       const user = await db.login(u);
       // @ts-ignore
       if (user.password !== simpleHash(p || '')) throw new Error("Неверный пароль");
       if (user.isBanned) throw new Error("Пользователь забанен");
       setCurrentUser(user);
       db.setSession(user.id);
    } else {
       const user = await mongo.login(u, p);
       if (user.isBanned) throw new Error("Пользователь забанен");
       setCurrentUser(user);
       mongo.setSession(user.id);
    }
    await loadData(false);
  };

  const register = async (u: string, e: string, p?: string) => {
    if (isOffline) {
       const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(u)}&background=random&color=fff&size=256&bold=true`;
       const defaultRole = roles.find(r => r.isDefault);
       
       const payload: User = {
         id: '', username: u, email: e, 
         password: simpleHash(p || ''), 
         avatarUrl, 
         roleId: defaultRole ? defaultRole.id : 'role_user', 
         isBanned: false,
         messages: 0, reactions: 0, points: 0, joinedAt: new Date().toISOString(), notifications: []
       };
       const created = await db.addUser(payload);
       setCurrentUser(created);
       db.setSession(created.id);
    } else {
       const created = await mongo.addUser({ username: u, email: e, password: p } as any);
       setCurrentUser(created);
       mongo.setSession(created.id);
    }
    await loadData(false);
  };

  const logout = () => { setCurrentUser(null); mutationApi.clearSession(); };

  const sendNotification = async (targetUserId: string, message: string, link: string) => {
    if (!currentUser || targetUserId === currentUser.id) return; 
    
    const targetUser = users[targetUserId];
    if (!targetUser) return;

    const newNotif: Notification = {
      id: `n${Date.now()}`,
      userId: targetUserId,
      type: 'reply',
      message,
      link,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    const updatedNotifications = [newNotif, ...targetUser.notifications];
    
    await mutationApi.updateUser({
      ...targetUser,
      notifications: updatedNotifications
    });
  };

  const updateUserActivity = async (activity: UserActivity) => {
    if (!currentUser) return;
    
    const now = Date.now();
    const typeChanged = currentUser.currentActivity?.type !== activity.type;
    
    if (!typeChanged && (now - lastActivityUpdate.current < 10000)) {
        return;
    }

    lastActivityUpdate.current = now;

    try {
        if (useMongo && !isOffline) {
           await fetch(`${APP_CONFIG.API_URL}/users/${currentUser.id}/activity`, {
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ activity })
           });
        } else {
           const updated = { ...currentUser, lastActiveAt: new Date().toISOString(), currentActivity: activity };
           await db.updateUser(updated);
           setCurrentUser(updated);
        }
    } catch (e) {
        console.error("Failed to update activity", e);
    }
  };

  const createThread = (fid: string, title: string, content: string, pid?: string) => mutate(async () => {
    if(!currentUser) return;
    const forum = forums.find(f => f.id === fid);
    if (!forum) return;

    if (forum.isClosed && !hasPermission(currentUser, 'canManageForums')) {
       throw new Error("Этот форум закрыт. Вы не можете создавать здесь темы.");
    }

    const tid = `t${Date.now()}`;
    const now = new Date().toISOString();
    
    await mutationApi.addThread({ 
      id: tid, forumId: fid, title, authorId: currentUser.id, 
      createdAt: now, viewCount: 0, replyCount: 0, isLocked: false, isPinned: false, prefixId: pid, order: 0 
    });

    await mutationApi.addPost({ 
      id: `p${Date.now()}`, threadId: tid, authorId: currentUser.id, 
      content, createdAt: now, likedBy: [], likes: 0, number: 1 
    });

    await mutationApi.updateForum({
      ...forum,
      threadCount: (forum.threadCount || 0) + 1,
      messageCount: (forum.messageCount || 0) + 1,
      lastPost: { threadId: tid, threadTitle: title, authorId: currentUser.id, createdAt: now, prefixId: pid }
    });
    
    updateUser({...currentUser, messages: currentUser.messages + 1, points: currentUser.points + 5});
    // Optimistic: load threads immediately
    loadThreadsForForum(fid);
  });

  const updateThread = (threadId: string, data: Partial<Thread>) => mutate(async () => {
     const t = getThread(threadId);
     if(t) {
        const updated = { ...t, ...data };
        await mutationApi.updateThread(updated);
        if (data.title || data.prefixId) {
           const forum = getForum(t.forumId);
           if (forum && forum.lastPost && forum.lastPost.threadId === t.id) {
              await mutationApi.updateForum({
                 ...forum,
                 lastPost: {
                    ...forum.lastPost,
                    threadTitle: data.title || t.title,
                    prefixId: data.prefixId !== undefined ? data.prefixId : t.prefixId
                 }
              });
           }
        }
     }
  });

  const deleteThread = (threadId: string) => mutate(async () => {
     await mutationApi.deleteThread(threadId);
  });

  const adminMoveThread = (threadId: string, newForumId: string) => mutate(async () => {
    const thread = getThread(threadId);
    if (!thread) return;
    if (thread.forumId === newForumId) return;

    await mutationApi.updateThread({
        ...thread,
        forumId: newForumId
    });
  });

  const adminReorderThread = (threadId: string, direction: 'up' | 'down') => mutate(async () => {
     const thread = getThread(threadId);
     if (!thread) return;
     
     const siblings = threads.filter(t => t.forumId === thread.forumId);
     const sortedSiblings = siblings.sort((a,b) => {
         if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
         return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
     });

     const normalized = sortedSiblings.map((t, idx) => ({ ...t, order: idx }));
     
     const index = normalized.findIndex(t => t.id === threadId);
     if (index === -1) return;

     if (direction === 'up' && index > 0) {
        normalized[index].order = index - 1;
        normalized[index - 1].order = index;
        await mutationApi.updateThread(normalized[index]);
        await mutationApi.updateThread(normalized[index - 1]);
     } else if (direction === 'down' && index < normalized.length - 1) {
        normalized[index].order = index + 1;
        normalized[index + 1].order = index;
        await mutationApi.updateThread(normalized[index]);
        await mutationApi.updateThread(normalized[index + 1]);
     }
  });

  const replyToThread = (tid: string, content: string) => mutate(async () => {
    if(!currentUser) return;
    const thread = getThread(tid);
    if(!thread) return;

    const forum = forums.find(f => f.id === thread.forumId);
    if (forum && forum.isClosed && !hasPermission(currentUser, 'canManageForums')) {
       throw new Error("Этот форум закрыт. Вы не можете отвечать в темах.");
    }

    if (thread.isLocked && !hasPermission(currentUser, 'canLockThreads')) {
       throw new Error("Эта тема закрыта.");
    }
    
    const now = new Date().toISOString();

    await mutationApi.updateThread({ 
      ...thread, 
      replyCount: thread.replyCount + 1, 
      lastPost: { authorId: currentUser.id, createdAt: now } 
    });

    const pid = `p${Date.now()}`;
    await mutationApi.addPost({ 
      id: pid, threadId: tid, authorId: currentUser.id, 
      content, createdAt: now, likedBy: [], likes: 0, number: (getPostsByThread(tid).length || 0) + 1 
    });

    if (forum) {
      await mutationApi.updateForum({
         ...forum,
         messageCount: (forum.messageCount || 0) + 1,
         lastPost: { threadId: thread.id, threadTitle: thread.title, authorId: currentUser.id, createdAt: now, prefixId: thread.prefixId }
      });
   }

   await sendNotification(
     thread.authorId, 
     `${currentUser.username} ответил в вашей теме "${thread.title}"`,
     `/thread/${tid}#post-${pid}`
   );

    updateUser({...currentUser, messages: currentUser.messages + 1, points: currentUser.points + 2});
    loadPostsForThread(tid); // Refresh posts
  });

  const editPost = (pid: string, content: string) => mutate(() => mutationApi.updatePost({ ...posts.find(p=>p.id===pid)!, content }));
  const deletePost = (pid: string) => mutate(() => mutationApi.deletePost(pid));
  
  const toggleLike = async (pid: string) => {
     if(!currentUser) return;
     const post = posts.find(p => p.id === pid);
     if(!post) return;
     
     const liked = post.likedBy?.includes(currentUser.id);
     const newLikedBy = liked ? post.likedBy.filter(id => id !== currentUser.id) : [...(post.likedBy||[]), currentUser.id];
     const newPost = { ...post, likedBy: newLikedBy, likes: newLikedBy.length };
     
     setPosts(prev => prev.map(p => p.id === pid ? newPost : p));
     await mutationApi.updatePost(newPost);

     if (!liked) {
        const author = users[post.authorId];
        if (author) {
            await mutationApi.updateUser({
                ...author,
                reactions: (author.reactions || 0) + 1,
                points: (author.points || 0) + 1
            });
            
            await sendNotification(
                post.authorId,
                `${currentUser.username} оценил ваше сообщение`,
                `/thread/${post.threadId}#post-${pid}`
            );
        }
     }
  };

  const toggleThreadLock = (tid: string) => mutate(async () => { const t = getThread(tid); if(t) await mutationApi.updateThread({...t, isLocked: !t.isLocked}); });
  const toggleThreadPin = (tid: string) => mutate(async () => { const t = getThread(tid); if(t) await mutationApi.updateThread({...t, isPinned: !t.isPinned}); });

  const updateUser = (u: User) => mutate(() => mutationApi.updateUser(u));
  const banUser = (uid: string, v: boolean) => mutate(async () => { const u = users[uid]; if(u) await mutationApi.updateUser({...u, isBanned: v}); });
  const markNotificationsRead = () => mutate(async () => { if(currentUser) await mutationApi.updateUser({...currentUser, notifications: currentUser.notifications.map(n=>({...n, isRead:true}))}); });

  const adminCreateCategory = (t: string, b: string) => mutate(() => mutationApi.addCategory({id:`c${Date.now()}`, title:t, backgroundUrl:b, order: categories.length}));
  const adminUpdateCategory = (id: string, t: string, b: string) => mutate(async () => {
    const existing = categories.find(c => c.id === id);
    if(existing) await safeUpdateCategory({ ...existing, title: t, backgroundUrl: b }); 
  });
  
  const adminMoveCategory = (id: string, direction: 'up' | 'down') => mutate(async () => {
     const sorted = [...categories].sort((a,b) => (a.order||0) - (b.order||0));
     const normalized = sorted.map((c, idx) => ({ ...c, order: idx }));
     const index = normalized.findIndex(c => c.id === id);
     if (index === -1) return;

     if (direction === 'up' && index > 0) {
        normalized[index].order = index - 1;
        normalized[index - 1].order = index;
        await safeUpdateCategory(normalized[index]);
        await safeUpdateCategory(normalized[index - 1]);
     } else if (direction === 'down' && index < normalized.length - 1) {
        normalized[index].order = index + 1;
        normalized[index + 1].order = index;
        await safeUpdateCategory(normalized[index]);
        await safeUpdateCategory(normalized[index + 1]);
     }
  });

  const adminDeleteCategory = (id: string) => mutate(() => mutationApi.deleteCategory(id));
  
  const adminCreateForum = (cid: string, n: string, d: string, i: string, pid?: string, isClosed: boolean = false) => mutate(() => mutationApi.addForum({
     id:`f${Date.now()}`, categoryId:cid, parentId:pid, name:n, description:d, icon:i, isClosed, threadCount:0, messageCount:0, order: 999
  })); 
  
  const adminUpdateForum = (id: string, cid: string, n: string, d: string, i: string, pid?: string, isClosed: boolean = false) => mutate(async () => {
     const existing = forums.find(f => f.id === id);
     if(existing) {
        await mutationApi.updateForum({ ...existing, categoryId: cid, name: n, description: d, icon: i, parentId: pid, isClosed });
     }
  });

  const adminMoveForum = (id: string, direction: 'up' | 'down') => mutate(async () => {
     const targetForum = forums.find(f => f.id === id);
     if(!targetForum) return;

     const siblings = forums.filter(f => f.categoryId === targetForum.categoryId && f.parentId === targetForum.parentId);
     const sortedSiblings = siblings.sort((a,b) => (a.order||0) - (b.order||0));
     
     const normalized = sortedSiblings.map((f, idx) => ({ ...f, order: idx }));
     const index = normalized.findIndex(f => f.id === id);
     if (index === -1) return;

     if (direction === 'up' && index > 0) {
        normalized[index].order = index - 1;
        normalized[index - 1].order = index;
        await mutationApi.updateForum(normalized[index]);
        await mutationApi.updateForum(normalized[index - 1]);
     } else if (direction === 'down' && index < normalized.length - 1) {
        normalized[index].order = index + 1;
        normalized[index + 1].order = index;
        await mutationApi.updateForum(normalized[index]);
        await mutationApi.updateForum(normalized[index + 1]);
     }
  });

  const adminDeleteForum = (id: string) => mutate(() => mutationApi.deleteForum(id));
  
  const adminUpdateUserRole = (uid: string, rid: string, srid?: string) => mutate(async () => { const u = users[uid]; if(u) await mutationApi.updateUser({...u, roleId:rid, secondaryRoleId:srid}); });
  const adminCreatePrefix = (t: string, c: string) => mutate(() => mutationApi.addPrefix({id:`px${Date.now()}`, text:t, color:c}));
  const adminDeletePrefix = (id: string) => mutate(() => mutationApi.deletePrefix(id));
  const adminCreateRole = (n: string, c: string, p: Permissions, e?: string) => mutate(() => mutationApi.addRole({id:`r${Date.now()}`, name:n, color:c, permissions:p, effect:e, isSystem:false, priority:0}));
  const adminUpdateRole = (r: Role) => mutate(() => mutationApi.updateRole(r));
  const adminDeleteRole = (id: string) => mutate(() => mutationApi.deleteRole(id));
  
  const adminSetDefaultRole = (roleId: string) => mutate(async () => {
     const role = roles.find(r => r.id === roleId);
     if (role) {
        await mutationApi.updateRole({ ...role, isDefault: true });
     }
  });

  const userRole = currentUser ? (getUserRole(currentUser) || null) : null;

  if (fatalError) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center">
         <ServerCrash className="w-20 h-20 text-red-600 mb-6" />
         <h1 className="text-3xl font-bold text-white mb-2">Системная ошибка</h1>
         <p className="text-gray-400 max-w-md mb-8">{fatalError}</p>
         <button onClick={() => { setFatalError(null); loadData(true); }} className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200">Повторить</button>
      </div>
    );
  }

  if (loading) {
     return <div className="fixed inset-0 bg-black flex items-center justify-center z-[9999]"><Loader2 className="w-10 h-10 text-cyan-500 animate-spin" /></div>;
  }

  return (
    <ForumContext.Provider value={{
      categories, forums, threads, posts, users, currentUser, prefixes, roles, userRole, loading, isOfflineMode: isOffline,
      getForum, getThread, getPostsByThread, getPostsByUser, getForumsByCategory, getSubForums, getUser, getUserRole, getUserRoles, hasPermission,
      login, register, logout,
      createThread, updateThread, deleteThread, replyToThread, editPost, deletePost, toggleLike, toggleThreadLock, toggleThreadPin,
      updateUser, updateUserActivity, banUser, markNotificationsRead,
      adminCreateCategory, adminUpdateCategory, adminMoveCategory, adminDeleteCategory, 
      adminCreateForum, adminUpdateForum, adminMoveForum, adminDeleteForum, adminUpdateUserRole,
      adminMoveThread, adminReorderThread,
      adminCreatePrefix, adminDeletePrefix, adminCreateRole, adminUpdateRole, adminDeleteRole, adminSetDefaultRole, search,
      loadThreadsForForum, loadPostsForThread, loadUserPosts
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


