import { Category, Forum, Thread, Post, User, Prefix, Role } from './types';

export const ROLE_EFFECTS = [
  { id: '', name: 'Нет (Статичный)' },
  { id: 'gradient', name: 'Радужный градиент' },
  { id: 'fire', name: 'Огонь / Горение' },
  { id: 'snow', name: 'Снегопад' },
  { id: 'lightning', name: 'Молния / Вспышки' },
  { id: 'sparkle', name: 'Искры / Звезды' },
  { id: 'glitch', name: 'Техно Глитч' },
];

export const SEED_PREFIXES: Prefix[] = [
  { id: 'pref_info', text: 'Информация', color: 'blue' },
  { id: 'pref_imp', text: 'Важно', color: 'orange' },
  { id: 'pref_app', text: 'Одобрено', color: 'green' },
  { id: 'pref_den', text: 'Отказано', color: 'red' },
  { id: 'pref_rev', text: 'На рассмотрении', color: 'yellow' },
];

export const SEED_ROLES: Role[] = [
  {
    id: 'role_admin',
    name: 'Администратор',
    color: '#ef4444', // Red-500
    effect: 'lightning', // Added default effect
    isSystem: true,
    isDefault: false,
    priority: 100,
    permissions: {
      canViewAdminPanel: true,
      canViewAdminDashboard: true,
      canViewAdminUsers: true,
      canViewAdminForums: true,
      canViewAdminThreads: true,
      canViewAdminRoles: true,
      canViewAdminPrefixes: true,
      
      canViewProfiles: true,
      canViewMemberList: true,
      canSearch: true,
      canCreateThread: true,
      canReply: true,
      canUseRichText: true,
      canUploadImages: true,
      canLockThreads: true,
      canPinThreads: true,
      canDeleteOwnThreads: true,
      canDeleteAnyThread: true,
      canEditOwnThreads: true,
      canEditAnyThread: true,
      canDeleteOwnPosts: true,
      canEditOwnPosts: true,
      canDeleteAnyPost: true,
      canEditAnyPost: true,
      
      canBanUsers: true,
      canViewUserEmails: true,
      canManageUsers: true,
      
      canManageForums: true,
      canManageCategories: true,
      
      canManageRoles: true,
      canCreateRole: true,
      canEditRole: true,
      canDeleteRole: true,
      
      canManagePrefixes: true,
      canUploadAvatar: true,
      canUploadBanner: true,
      canUseSignature: true,
      canChangeCustomTitle: true,
      canChangeUsername: true,
      canCloseOwnThreads: true
    }
  },
  {
    id: 'role_leader',
    name: 'Лидер',
    color: '#a855f7', // Purple-500
    effect: 'sparkle',
    isSystem: false,
    isDefault: false,
    priority: 80,
    permissions: {
      canViewAdminPanel: false,
      canViewAdminDashboard: false,
      canViewAdminUsers: false,
      canViewAdminForums: false,
      canViewAdminThreads: false,
      canViewAdminRoles: false,
      canViewAdminPrefixes: false,

      canViewProfiles: true,
      canViewMemberList: true,
      canSearch: true,
      canCreateThread: true,
      canReply: true,
      canUseRichText: true,
      canUploadImages: true,
      canLockThreads: false,
      canPinThreads: false,
      canDeleteOwnThreads: true,
      canDeleteAnyThread: false,
      canEditOwnThreads: true,
      canEditAnyThread: true,
      canDeleteOwnPosts: true,
      canEditOwnPosts: true,
      canDeleteAnyPost: false,
      canEditAnyPost: false,
      
      canBanUsers: false,
      canViewUserEmails: false,
      canManageUsers: false,
      
      canManageForums: false,
      canManageCategories: false,
      
      canManageRoles: false,
      canCreateRole: false,
      canEditRole: false,
      canDeleteRole: false,
      
      canManagePrefixes: false,
      canUploadAvatar: true,
      canUploadBanner: true,
      canUseSignature: true,
      canChangeCustomTitle: true,
      canChangeUsername: false,
      canCloseOwnThreads: true
    }
  },
  {
    id: 'role_user',
    name: 'Пользователь',
    color: '#9ca3af', // Gray-400
    isSystem: true,
    isDefault: true, // Default role for new users
    priority: 10,
    permissions: {
      canViewAdminPanel: false,
      canViewAdminDashboard: false,
      canViewAdminUsers: false,
      canViewAdminForums: false,
      canViewAdminThreads: false,
      canViewAdminRoles: false,
      canViewAdminPrefixes: false,

      canViewProfiles: true,
      canViewMemberList: true,
      canSearch: true,
      canCreateThread: true,
      canReply: true,
      canUseRichText: true,
      canUploadImages: false,
      canLockThreads: false,
      canPinThreads: false,
      canDeleteOwnThreads: true, 
      canDeleteAnyThread: false,
      canEditOwnThreads: true, 
      canEditAnyThread: false, 
      canDeleteOwnPosts: true, 
      canEditOwnPosts: true,
      canDeleteAnyPost: false,
      canEditAnyPost: false,
      
      canBanUsers: false,
      canViewUserEmails: false,
      canManageUsers: false,
      
      canManageForums: false,
      canManageCategories: false,
      
      canManageRoles: false,
      canCreateRole: false,
      canEditRole: false,
      canDeleteRole: false,
      
      canManagePrefixes: false,
      canUploadAvatar: true,
      canUploadBanner: true,
      canUseSignature: true,
      canChangeCustomTitle: false,
      canChangeUsername: false,
      canCloseOwnThreads: false
    }
  },
  {
    id: 'role_guest',
    name: 'Гость',
    color: '#6b7280', // Gray-500
    isSystem: true,
    isDefault: false,
    priority: 0,
    permissions: {
      canViewAdminPanel: false,
      canViewAdminDashboard: false,
      canViewAdminUsers: false,
      canViewAdminForums: false,
      canViewAdminThreads: false,
      canViewAdminRoles: false,
      canViewAdminPrefixes: false,

      canViewProfiles: false, // RESTRICTED
      canViewMemberList: false, // RESTRICTED
      canSearch: false,
      canCreateThread: false,
      canReply: false,
      canUseRichText: false,
      canUploadImages: false,
      canLockThreads: false,
      canPinThreads: false,
      canDeleteOwnThreads: false,
      canDeleteAnyThread: false,
      canEditOwnThreads: false,
      canEditAnyThread: false,
      canDeleteOwnPosts: false,
      canEditOwnPosts: false,
      canDeleteAnyPost: false,
      canEditAnyPost: false,
      
      canBanUsers: false,
      canViewUserEmails: false,
      canManageUsers: false,
      
      canManageForums: false,
      canManageCategories: false,
      
      canManageRoles: false,
      canCreateRole: false,
      canEditRole: false,
      canDeleteRole: false,
      
      canManagePrefixes: false,
      canUploadAvatar: false,
      canUploadBanner: false,
      canUseSignature: false,
      canChangeCustomTitle: false,
      canChangeUsername: false,
      canCloseOwnThreads: false
    }
  }
];

export const SEED_CATEGORIES: Category[] = [
  { id: 'c1', title: 'Black Project | Официальная информация', backgroundUrl: 'bg-gradient-to-r from-cyan-900 to-slate-900', order: 0 },
  { id: 'c2', title: 'Игровой сервер | Server One', backgroundUrl: 'bg-gradient-to-r from-slate-900 to-cyan-900', order: 1 },
  { id: 'c3', title: 'Вне игры (OOC)', backgroundUrl: 'bg-gradient-to-r from-gray-900 to-gray-800', order: 2 },
];

export const SEED_FORUMS: Forum[] = [
  {
    id: 'f1',
    categoryId: 'c1',
    name: 'Правила проекта',
    description: 'Общие правила, уголовный кодекс и политика сервера.',
    icon: 'BookOpen',
    threadCount: 0,
    messageCount: 0,
    order: 0
  },
  {
    id: 'f2',
    categoryId: 'c1',
    name: 'Новости и обновления',
    description: 'Последние изменения и объявления.',
    icon: 'Megaphone',
    threadCount: 0,
    messageCount: 0,
    order: 1
  },
  {
    id: 'f3',
    categoryId: 'c2',
    name: 'Жалобы и заявления',
    description: 'Жалобы на игроков, заявки на лидерство, апелляции.',
    icon: 'Scale',
    threadCount: 0,
    messageCount: 0,
    order: 0
  },
  {
    id: 'f4',
    categoryId: 'c2',
    name: 'Фракции',
    description: 'Государственные и криминальные организации.',
    icon: 'Users',
    threadCount: 0,
    messageCount: 0,
    order: 1
  },
  {
    id: 'f5',
    categoryId: 'c3',
    name: 'Общее обсуждение',
    description: 'Общение на свободные темы.',
    icon: 'MessageCircle',
    threadCount: 0,
    messageCount: 0,
    order: 0
  }
];

export const MOCK_CATEGORIES = SEED_CATEGORIES;
export const MOCK_FORUMS = SEED_FORUMS;
export const MOCK_USERS: Record<string, User> = {};
export const MOCK_THREADS: Thread[] = [];
export const MOCK_POSTS: Post[] = [];

