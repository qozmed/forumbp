import { User, Thread, Post, Forum, Category, Prefix, Role } from '../types';
import { APP_CONFIG } from '../config';

const API_URL = APP_CONFIG.API_URL;

async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60000); 
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    clearTimeout(id);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const txt = await res.text();
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const json = JSON.parse(txt);
        if (json.error) errorMsg = json.error;
      } catch {}
      throw new Error(errorMsg);
    }
    return res.json();
  } catch (error: any) {
    console.error(`API Call Failed [${endpoint}]:`, error.message);
    throw error;
  }
}

export const mongo = {
  checkHealth,
  
  // Auth
  async login(u: string, p?: string): Promise<User | { require2fa: boolean, userId: string }> {
    return apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ email: u, password: p }) }); // NOTE: email passed as 'u' to match interface signature, fixed in context
  },
  async verify2FA(userId: string, code: string): Promise<User> {
    return apiCall('/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ userId, code }) });
  },
  async addUser(user: User): Promise<User> {
    return apiCall('/auth/register', { method: 'POST', body: JSON.stringify(user) });
  },

  // Telegram
  async getTelegramLink(userId: string): Promise<{ link: string }> {
    return apiCall('/user/telegram-link', { method: 'POST', body: JSON.stringify({ userId }) });
  },
  async sendNotification(targetUserId: string, message: string, link: string) {
    return apiCall('/notifications/send', { method: 'POST', body: JSON.stringify({ targetUserId, message, link }) });
  },
  async broadcast(text: string) {
    return apiCall('/admin/broadcast', { method: 'POST', body: JSON.stringify({ text }) });
  },

  // Getters
  async getCategories(): Promise<Category[]> { return apiCall('/categories'); },
  async getForums(): Promise<Forum[]> { return apiCall('/forums'); },
  async getThread(id: string): Promise<Thread> { return apiCall(`/threads/${id}`); },
  async getThreads(forumId?: string, limit?: number): Promise<Thread[]> { 
    let query = '/threads?';
    if (forumId) query += `forumId=${forumId}&`;
    if (limit) query += `limit=${limit}&`;
    if (!forumId && limit) query += `sort=recent&`;
    return apiCall(query); 
  },
  async getPosts(threadId?: string, userId?: string): Promise<Post[]> { 
    let query = '/posts?';
    if (threadId) query += `threadId=${threadId}&`;
    if (userId) query += `userId=${userId}&`;
    return apiCall(query); 
  },
  async getPrefixes(): Promise<Prefix[]> { return apiCall('/prefixes'); },
  async getRoles(): Promise<Role[]> { return apiCall('/roles'); },
  async getUsers(): Promise<Record<string, User>> {
    const list = await apiCall('/users');
    return (list || []).reduce((acc: any, u: User) => { acc[u.id] = u; return acc; }, {});
  },
  
  // NEW: Get full user data for session user
  async getUserSync(userId: string): Promise<User> {
    return apiCall(`/users/${userId}/sync`);
  },

  // Mutations (Standard CRUD)
  async addCategory(d: Category) { return apiCall('/categories', { method: 'POST', body: JSON.stringify(d) }); },
  async deleteCategory(id: string) { return apiCall(`/categories/${id}`, { method: 'DELETE' }); },
  async addForum(d: Forum) { return apiCall('/forums', { method: 'POST', body: JSON.stringify(d) }); },
  async updateForum(d: Forum) { return apiCall(`/forums/${d.id}`, { method: 'PUT', body: JSON.stringify(d) }); },
  async deleteForum(id: string) { return apiCall(`/forums/${id}`, { method: 'DELETE' }); },
  async addThread(d: Thread) { return apiCall('/threads', { method: 'POST', body: JSON.stringify(d) }); },
  async updateThread(d: Thread) { return apiCall(`/threads/${d.id}`, { method: 'PUT', body: JSON.stringify(d) }); },
  async deleteThread(id: string) { return apiCall(`/threads/${id}`, { method: 'DELETE' }); },
  async addPost(d: Post) { return apiCall('/posts', { method: 'POST', body: JSON.stringify(d) }); },
  async updatePost(d: Post) { return apiCall(`/posts/${d.id}`, { method: 'PUT', body: JSON.stringify(d) }); },
  async deletePost(id: string) { return apiCall(`/posts/${id}`, { method: 'DELETE' }); },
  async addPrefix(d: Prefix) { return apiCall('/prefixes', { method: 'POST', body: JSON.stringify(d) }); },
  async deletePrefix(id: string) { return apiCall(`/prefixes/${id}`, { method: 'DELETE' }); },
  async addRole(d: Role) { return apiCall('/roles', { method: 'POST', body: JSON.stringify(d) }); },
  async updateRole(d: Role) { return apiCall(`/roles/${d.id}`, { method: 'PUT', body: JSON.stringify(d) }); },
  async deleteRole(id: string) { return apiCall(`/roles/${id}`, { method: 'DELETE' }); },
  async updateUser(d: User) { return apiCall(`/users/${d.id}`, { method: 'PUT', body: JSON.stringify(d) }); },

  // Session
  getSession() { return localStorage.getItem('mongo_token'); },
  setSession(id: string) { localStorage.setItem('mongo_token', id); },
  clearSession() { localStorage.removeItem('mongo_token'); }
};
