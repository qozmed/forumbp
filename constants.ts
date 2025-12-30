import { Category, Forum, Thread, Post, User, Prefix, Role } from './types';

export const ROLE_EFFECTS = [
  { id: '', name: 'None (Static)' },
  { id: 'gradient', name: 'Iridescent Gradient' },
  { id: 'fire', name: 'Fire / Burn' },
  { id: 'snow', name: 'Snowfall' },
  { id: 'lightning', name: 'Lightning Flash' },
  { id: 'sparkle', name: 'Sparkle / Stars' },
  { id: 'glitch', name: 'Tech Glitch' },
];

export const SEED_PREFIXES: Prefix[] = [
  { id: 'pref_info', text: 'Information', color: 'blue' },
  { id: 'pref_imp', text: 'Important', color: 'orange' },
  { id: 'pref_app', text: 'Approved', color: 'green' },
  { id: 'pref_den', text: 'Denied', color: 'red' },
  { id: 'pref_rev', text: 'On Review', color: 'yellow' },
];

export const SEED_ROLES: Role[] = [
  {
    id: 'role_admin',
    name: 'Administrator',
    color: '#ef4444', // Red-500
    effect: 'lightning', // Added default effect
    isSystem: true,
    isDefault: false,
    priority: 100,
    permissions: {
      canViewAdminPanel: true,
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
      canEditOwnThreads: true, // NEW
      canEditAnyThread: true, // NEW
      canDeleteOwnPosts: true,
      canEditOwnPosts: true,
      canDeleteAnyPost: true,
      canEditAnyPost: true,
      canBanUsers: true,
      canViewUserEmails: true,
      canManageForums: true,
      canManageCategories: true,
      canManageRoles: true,
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
    name: 'Leader',
    color: '#a855f7', // Purple-500
    effect: 'sparkle',
    isSystem: false,
    isDefault: false,
    priority: 80,
    permissions: {
      canViewAdminPanel: false,
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
      canEditOwnThreads: true, // NEW
      canEditAnyThread: true, // NEW
      canDeleteOwnPosts: true,
      canEditOwnPosts: true,
      canDeleteAnyPost: false,
      canEditAnyPost: false,
      canBanUsers: false,
      canViewUserEmails: false,
      canManageForums: false,
      canManageCategories: false,
      canManageRoles: false,
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
    name: 'User',
    color: '#9ca3af', // Gray-400
    isSystem: true,
    isDefault: true, // Default role for new users
    priority: 10,
    permissions: {
      canViewAdminPanel: false,
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
      canEditOwnThreads: true, // NEW
      canEditAnyThread: false, // NEW
      canDeleteOwnPosts: true, 
      canEditOwnPosts: true,
      canDeleteAnyPost: false,
      canEditAnyPost: false,
      canBanUsers: false,
      canViewUserEmails: false,
      canManageForums: false,
      canManageCategories: false,
      canManageRoles: false,
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
    name: 'Guest',
    color: '#6b7280', // Gray-500
    isSystem: true,
    isDefault: false,
    priority: 0,
    permissions: {
      canViewAdminPanel: false,
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
      canManageForums: false,
      canManageCategories: false,
      canManageRoles: false,
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

// Empty initial state
export const MOCK_CATEGORIES = SEED_CATEGORIES;
export const MOCK_FORUMS = SEED_FORUMS;
export const MOCK_USERS: Record<string, User> = {};
export const MOCK_THREADS: Thread[] = [];
export const MOCK_POSTS: Post[] = [];

