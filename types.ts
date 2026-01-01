export interface Permissions {
  // General Access
  canViewAdminPanel: boolean;
  canViewProfiles: boolean; // New: Guest restriction
  canViewMemberList: boolean; // New
  canSearch: boolean; // New
  
  // Thread Creation & Interaction
  canCreateThread: boolean;
  canReply: boolean;
  canUseRichText: boolean; // New: BBCode usage
  canUploadImages: boolean; // New
  
  // Thread Moderation
  canLockThreads: boolean;
  canPinThreads: boolean;
  canDeleteOwnThreads: boolean;
  canDeleteAnyThread: boolean;
  canEditOwnThreads: boolean; // NEW: Edit own thread title/prefix
  canEditAnyThread: boolean;  // NEW: Edit any thread title/prefix
  
  // Post Management
  canDeleteOwnPosts: boolean;
  canEditOwnPosts: boolean;
  canDeleteAnyPost: boolean;
  canEditAnyPost: boolean;
  
  // User Management
  canBanUsers: boolean;
  canViewUserEmails: boolean;
  
  // System Management
  canManageForums: boolean;
  canManageCategories: boolean;
  canManageRoles: boolean;
  canManagePrefixes: boolean;

  // Profile & Customization
  canUploadAvatar: boolean;
  canUploadBanner: boolean;
  canUseSignature: boolean;
  canChangeCustomTitle: boolean;
  canChangeUsername: boolean;

  // Self Moderation
  canCloseOwnThreads: boolean;
}

export interface Role {
  id: string;
  name: string;
  color: string; // CSS color class or hex
  effect?: string; // New: visual effect id
  isSystem: boolean; // Cannot be deleted (e.g., Guest, Admin)
  isDefault?: boolean; // New: Automatically assigned to new users
  permissions: Permissions;
  priority: number; // For sorting users in lists
}

export interface Prefix {
  id: string;
  text: string;
  color: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'reply' | 'system' | 'mention';
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface UserActivity {
  type: 'viewing_index' | 'viewing_forum' | 'viewing_thread' | 'creating_thread' | 'editing' | 'admin' | 'idle' | 'custom';
  text: string; // "Viewing thread 'Rules'"
  link?: string; // "/thread/123"
  timestamp: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  avatarUrl: string;
  roleId: string; // Primary Role
  secondaryRoleId?: string; // New: Secondary Role (optional)
  isBanned: boolean; // New ban status
  messages: number;
  reactions: number;
  points: number;
  joinedAt: string;
  bannerUrl?: string;
  customTitle?: string;
  signature?: string;
  notifications: Notification[];
  
  // Activity Tracking
  lastActiveAt?: string;
  currentActivity?: UserActivity;
}

export interface Post {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: string;
  likes?: number;
  likedBy: string[];
  number: number;
}

export interface Thread {
  id: string;
  forumId: string;
  title: string;
  authorId: string;
  createdAt: string;
  viewCount: number;
  replyCount: number;
  isLocked: boolean;
  isPinned: boolean;
  prefixId?: string;
  order?: number; // Manual ordering
  lastPost?: {
    authorId: string;
    createdAt: string;
  };
}

export interface Forum {
  id: string;
  categoryId: string;
  parentId?: string;
  name: string;
  description: string;
  icon: string;
  isClosed?: boolean; // New: Lock entire forum
  threadCount: number;
  messageCount: number;
  order?: number; // Sorting order
  lastPost?: {
    threadId: string;
    threadTitle: string;
    authorId: string;
    createdAt: string;
    prefixId?: string;
  };
  subForums?: Forum[];
}

export interface Category {
  id: string;
  title: string;
  backgroundUrl?: string;
  order?: number; // Sorting order
}