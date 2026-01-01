import React, { useState, useRef } from 'react';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { User, Permissions, Forum, Category, Role } from '../types';
import { Shield, FolderPlus, MessageSquarePlus, Trash2, Tag, ChevronRight, CornerDownRight, Edit2, X, ArrowUp, ArrowDown, Activity, Users, MessageCircle, Lock, Pencil, Check } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import PrefixBadge from '../components/UI/PrefixBadge';
import { ROLE_EFFECTS } from '../constants';
import RoleBadge from '../components/UI/RoleBadge';

const AdminPanel: React.FC = () => {
  const { 
    currentUser, categories, forums, users, prefixes, roles, threads, posts,
    adminCreateCategory, adminUpdateCategory, adminMoveCategory, adminDeleteCategory, 
    adminCreateForum, adminUpdateForum, adminMoveForum, adminDeleteForum,
    adminUpdateUserRole, adminCreatePrefix, adminDeletePrefix,
    adminCreateRole, adminUpdateRole, adminDeleteRole, adminSetDefaultRole, hasPermission, banUser
  } = useForum();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'forums' | 'users' | 'prefixes' | 'roles'>('dashboard');

  // Refs for scrolling
  const roleFormRef = useRef<HTMLDivElement>(null);
  const catFormRef = useRef<HTMLDivElement>(null);

  // State for Editing Categories/Forums
  const [editingItem, setEditingItem] = useState<{ type: 'category' | 'forum', id: string } | null>(null);

  // Forms state
  const [catName, setCatName] = useState('');
  const [forumName, setForumName] = useState('');
  const [forumDesc, setForumDesc] = useState('');
  const [isForumClosed, setIsForumClosed] = useState(false);
  const [parentType, setParentType] = useState<'category' | 'forum'>('category');
  const [selectedParentId, setSelectedParentId] = useState('');
  
  // Prefix Form
  const [prefixText, setPrefixText] = useState('');
  const [prefixColor, setPrefixColor] = useState('#ffffff');

  // Role Form
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#ffffff');
  const [roleEffect, setRoleEffect] = useState(''); 
  
  const initialPermissions: Permissions = {
    canViewAdminPanel: false, canViewProfiles: false, canViewMemberList: false, canSearch: false,
    canCreateThread: true, canReply: true, canUseRichText: true, canUploadImages: false,
    canLockThreads: false, canPinThreads: false, canDeleteOwnThreads: true, canDeleteAnyThread: false, 
    canEditOwnThreads: true, canEditAnyThread: false,
    canDeleteOwnPosts: true, canEditOwnPosts: true, canDeleteAnyPost: false, canEditAnyPost: false,
    canBanUsers: false, canViewUserEmails: false, canManageForums: false, canManageCategories: false,
    canManageRoles: false, canManagePrefixes: false, canUploadAvatar: true, canUploadBanner: true,
    canUseSignature: true, canChangeCustomTitle: false, canChangeUsername: false, canCloseOwnThreads: false
  };

  const [permissions, setPermissions] = useState<Permissions>(initialPermissions);

  if (!currentUser || !hasPermission(currentUser, 'canViewAdminPanel')) return <Navigate to="/" />;

  // --- HANDLERS ---

  const handleCreateOrUpdateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if(catName) { 
      if (editingItem?.type === 'category') {
         await adminUpdateCategory(editingItem.id, catName, 'bg-gray-800');
         setEditingItem(null);
      } else {
         await adminCreateCategory(catName, 'bg-gray-800'); 
      }
      setCatName(''); 
    }
  };

  const handleCreateOrUpdateForum = async (e: React.FormEvent) => {
    e.preventDefault();
    if(selectedParentId && forumName) {
      const categoryId = parentType === 'category' 
        ? selectedParentId 
        : (forums.find(f => f.id === selectedParentId)?.categoryId || '');
      
      const parentId = parentType === 'forum' ? selectedParentId : undefined;

      if (editingItem?.type === 'forum') {
         await adminUpdateForum(editingItem.id, categoryId, forumName, forumDesc, 'MessageCircle', parentId, isForumClosed);
         setEditingItem(null);
      } else {
         await adminCreateForum(categoryId, forumName, forumDesc, 'MessageCircle', parentId, isForumClosed);
      }
      
      setForumName(''); setForumDesc(''); setIsForumClosed(false);
      // Keep parent selection for convenience if not editing
      if (editingItem) setSelectedParentId('');
    }
  };

  const handleCreatePrefix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prefixText) {
      await adminCreatePrefix(prefixText, prefixColor);
      setPrefixText(''); setPrefixColor('#ffffff');
    }
  };

  const handleCreateOrUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roleName) {
      if (editingRole) {
        // Update existing role
        await adminUpdateRole({
          ...editingRole,
          name: roleName,
          color: roleColor,
          effect: roleEffect,
          permissions: permissions
        });
        cancelEditRole();
      } else {
        // Create new role
        await adminCreateRole(roleName, roleColor, permissions, roleEffect);
        cancelEditRole(); // Reset form
      }
    }
  };

  // --- EDIT HELPERS ---

  const startEditCategory = (c: Category) => {
    setEditingItem({ type: 'category', id: c.id });
    setCatName(c.title);
    catFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startEditForum = (f: Forum) => {
    setEditingItem({ type: 'forum', id: f.id });
    setForumName(f.name);
    setForumDesc(f.description);
    setIsForumClosed(f.isClosed || false);
    
    if (f.parentId) {
      setParentType('forum');
      setSelectedParentId(f.parentId);
    } else {
      setParentType('category');
      setSelectedParentId(f.categoryId);
    }
    catFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setCatName('');
    setForumName('');
    setForumDesc('');
    setIsForumClosed(false);
    setSelectedParentId('');
  };

  const startEditRole = (r: Role) => {
    setEditingRole(r);
    setRoleName(r.name);
    setRoleColor(r.color);
    setRoleEffect(r.effect || '');
    // Merge with initial permissions to ensure new permission keys are present even if role data is old
    setPermissions({ ...initialPermissions, ...r.permissions });
    
    // Scroll form into view
    roleFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditRole = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleColor('#ffffff');
    setRoleEffect('');
    setPermissions(initialPermissions);
  };

  const togglePermission = (perm: keyof Permissions) => setPermissions(prev => ({ ...prev, [perm]: !prev[perm] }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
        <Shield className="w-8 h-8 text-red-500" /> {t('admin.title')}
      </h1>

      <div className="flex gap-4 mb-8 border-b border-gray-700 pb-1 overflow-x-auto">
        {['dashboard', 'forums', 'users', 'prefixes', 'roles'].map(tab => (
           <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 font-medium capitalize flex items-center gap-2 ${activeTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white'}`}>
             {t(`admin.${tab}`)}
           </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
         <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-900/30 rounded-full text-blue-400"><Users className="w-8 h-8" /></div>
                      <div>
                         <div className="text-3xl font-bold text-white">{Object.keys(users).length}</div>
                         <div className="text-gray-400 text-sm">{t('admin.totalUsers')}</div>
                      </div>
                   </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-900/30 rounded-full text-green-400"><MessageSquarePlus className="w-8 h-8" /></div>
                      <div>
                         <div className="text-3xl font-bold text-white">{threads.length}</div>
                         <div className="text-gray-400 text-sm">{t('admin.totalThreads')}</div>
                      </div>
                   </div>
                </div>
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-purple-900/30 rounded-full text-purple-400"><MessageCircle className="w-8 h-8" /></div>
                      <div>
                         <div className="text-3xl font-bold text-white">{posts.length}</div>
                         <div className="text-gray-400 text-sm">{t('admin.totalPosts')}</div>
                      </div>
                   </div>
                </div>
             </div>
             
             <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5" /> {t('admin.recentReg')}</h3>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm text-gray-400 min-w-[500px]">
                      <thead className="bg-gray-900 text-gray-200">
                         <tr>
                            <th className="px-4 py-2">{t('admin.user')}</th>
                            <th className="px-4 py-2">{t('admin.email')}</th>
                            <th className="px-4 py-2">{t('user.joined')}</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                         {(Object.values(users) as User[]).sort((a,b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()).slice(0, 5).map(u => (
                            <tr key={u.id}>
                               <td className="px-4 py-2 text-white">{u.username}</td>
                               <td className="px-4 py-2">{hasPermission(currentUser, 'canViewUserEmails') ? u.email : '***'}</td>
                               <td className="px-4 py-2">{new Date(u.joinedAt).toLocaleDateString()}</td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
         </div>
      )}

      {activeTab === 'forums' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" ref={catFormRef}>
          <div className="space-y-8">
             {/* Category Form */}
             <div className={`p-6 rounded-lg border transition-all ${editingItem?.type === 'category' ? 'bg-cyan-900/10 border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-gray-800 border-gray-700'}`}>
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                 <FolderPlus className="w-5 h-5" /> 
                 {editingItem?.type === 'category' ? t('admin.editCat') : t('admin.createCat')}
               </h3>
               <form onSubmit={handleCreateOrUpdateCat} className="space-y-4">
                 <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder={t('admin.catTitle')} required />
                 <div className="flex gap-2">
                   <button className="bg-cyan-600 px-4 py-2 rounded text-white font-bold flex-1 hover:bg-cyan-500">
                     {editingItem?.type === 'category' ? t('general.save') : t('admin.createCat')}
                   </button>
                   {editingItem?.type === 'category' && (
                     <button type="button" onClick={cancelEdit} className="bg-gray-700 px-4 py-2 rounded text-white hover:bg-gray-600">
                       <X className="w-5 h-5" />
                     </button>
                   )}
                 </div>
               </form>
             </div>

             {/* Forum Form */}
             <div className={`p-6 rounded-lg border transition-all ${editingItem?.type === 'forum' ? 'bg-cyan-900/10 border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-gray-800 border-gray-700'}`}>
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                 <MessageSquarePlus className="w-5 h-5" /> 
                 {editingItem?.type === 'forum' ? t('admin.editForum') : t('admin.createForum')}
               </h3>
               <form onSubmit={handleCreateOrUpdateForum} className="space-y-4">
                 <div className="flex gap-4">
                   <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="radio" name="parentType" value="category" checked={parentType === 'category'} onChange={() => setParentType('category')} /> {t('admin.insideCat')}</label>
                   <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"><input type="radio" name="parentType" value="forum" checked={parentType === 'forum'} onChange={() => setParentType('forum')} /> {t('admin.insideForum')}</label>
                 </div>
                 <select value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" required>
                   <option value="">{t('admin.selectParent')}</option>
                   {parentType === 'category' ? categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>) : forums.filter(f => !f.parentId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                 </select>
                 <input type="text" value={forumName} onChange={e => setForumName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder={t('admin.forumName')} required />
                 <input type="text" value={forumDesc} onChange={e => setForumDesc(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder={t('admin.forumDesc')} />
                 
                 <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer p-2 bg-gray-900 rounded border border-gray-600">
                    <input type="checkbox" checked={isForumClosed} onChange={e => setIsForumClosed(e.target.checked)} className="rounded" />
                    <span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-red-400" /> {t('admin.closeForum')}</span>
                 </label>

                 <div className="flex gap-2">
                   <button className="bg-cyan-600 px-4 py-2 rounded text-white font-bold flex-1 hover:bg-cyan-500">
                      {editingItem?.type === 'forum' ? t('general.save') : t('admin.createForum')}
                   </button>
                   {editingItem?.type === 'forum' && (
                     <button type="button" onClick={cancelEdit} className="bg-gray-700 px-4 py-2 rounded text-white hover:bg-gray-600">
                       <X className="w-5 h-5" />
                     </button>
                   )}
                 </div>
               </form>
             </div>
          </div>

          {/* STRUCTURE PREVIEW */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 h-fit">
            <h3 className="text-xl font-bold text-white mb-4">{t('admin.preview')}</h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
               {categories.map((c, idx) => {
                  const catForums = forums.filter(f => f.categoryId === c.id && !f.parentId);
                  return (
                    <div key={c.id} className="bg-gray-900 rounded border border-gray-700 overflow-hidden">
                       {/* Category Header */}
                       <div className="p-2 bg-gray-750 border-b border-gray-700 flex justify-between items-center group">
                          <div className="flex items-center gap-2">
                             {/* Ordering Arrows */}
                             <div className="flex flex-col">
                                <button onClick={() => adminMoveCategory(c.id, 'up')} disabled={idx === 0} className="text-gray-500 hover:text-white disabled:opacity-30">
                                   <ArrowUp className="w-3 h-3" />
                                </button>
                                <button onClick={() => adminMoveCategory(c.id, 'down')} disabled={idx === categories.length - 1} className="text-gray-500 hover:text-white disabled:opacity-30">
                                   <ArrowDown className="w-3 h-3" />
                                </button>
                             </div>
                             <span className="font-bold text-gray-200 text-sm">{c.title}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => startEditCategory(c)} className="text-blue-400 p-1 hover:bg-blue-900/20 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                             <button onClick={() => adminDeleteCategory(c.id)} className="text-red-500 p-1 hover:bg-red-900/20 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                       </div>
                       
                       {/* Forums List */}
                       <div className="p-2 space-y-1">
                          {catForums.length === 0 && <div className="text-xs text-gray-600 italic px-2">{t('general.noResults')}</div>}
                          {catForums.map((f, fIdx) => {
                             const subForums = forums.filter(sf => sf.parentId === f.id);
                             return (
                               <div key={f.id}>
                                  <div className="flex justify-between items-center text-sm text-gray-400 px-2 py-1 hover:bg-gray-800 rounded group">
                                     <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                          <button onClick={() => adminMoveForum(f.id, 'up')} disabled={fIdx === 0} className="text-gray-600 hover:text-white disabled:opacity-20"><ArrowUp className="w-2.5 h-2.5" /></button>
                                          <button onClick={() => adminMoveForum(f.id, 'down')} disabled={fIdx === catForums.length - 1} className="text-gray-600 hover:text-white disabled:opacity-20"><ArrowDown className="w-2.5 h-2.5" /></button>
                                        </div>
                                        <ChevronRight className="w-3 h-3" />
                                        <span>{f.name}</span>
                                        {f.isClosed && <Lock className="w-3 h-3 text-red-500" />}
                                     </div>
                                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button onClick={() => startEditForum(f)} className="text-blue-400 p-1 hover:bg-blue-900/20 rounded"><Edit2 className="w-3 h-3" /></button>
                                       <button onClick={() => adminDeleteForum(f.id)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
                                     </div>
                                  </div>
                                  
                                  {/* Sub Forums */}
                                  {subForums.length > 0 && (
                                     <div className="pl-6 space-y-1 mt-1 border-l border-gray-700 ml-2">
                                        {subForums.map((sf, sfIdx) => (
                                           <div key={sf.id} className="flex justify-between items-center text-xs text-gray-500 px-2 py-0.5 hover:bg-gray-800 rounded group">
                                             <div className="flex items-center gap-2">
                                                <div className="flex flex-col">
                                                  <button onClick={() => adminMoveForum(sf.id, 'up')} disabled={sfIdx === 0} className="text-gray-600 hover:text-white disabled:opacity-20"><ArrowUp className="w-2 h-2" /></button>
                                                  <button onClick={() => adminMoveForum(sf.id, 'down')} disabled={sfIdx === subForums.length - 1} className="text-gray-600 hover:text-white disabled:opacity-20"><ArrowDown className="w-2 h-2" /></button>
                                                </div>
                                                <CornerDownRight className="w-3 h-3" />
                                                <span>{sf.name}</span>
                                                {sf.isClosed && <Lock className="w-2.5 h-2.5 text-red-500" />}
                                             </div>
                                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditForum(sf)} className="text-blue-400 p-1 hover:bg-blue-900/20 rounded"><Edit2 className="w-3 h-3" /></button>
                                                <button onClick={() => adminDeleteForum(sf.id)} className="text-red-500"><Trash2 className="w-3 h-3" /></button>
                                             </div>
                                           </div>
                                        ))}
                                     </div>
                                  )}
                               </div>
                             );
                          })}
                       </div>
                    </div>
                  );
               })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400 min-w-[700px]">
              <thead className="bg-gray-750 uppercase font-medium">
                <tr>
                  <th className="px-6 py-3">{t('admin.user')}</th>
                  <th className="px-6 py-3">{t('admin.email')}</th>
                  <th className="px-6 py-3">{t('admin.primaryRole')}</th>
                  <th className="px-6 py-3">{t('admin.secRole')}</th>
                  <th className="px-6 py-3">{t('admin.status')}</th>
                  <th className="px-6 py-3">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {(Object.values(users) as User[]).map(user => (
                    <tr key={user.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 font-medium text-white">{user.username}</td>
                      <td className="px-6 py-4">{hasPermission(currentUser, 'canViewUserEmails') ? (user.email || '-') : '***'}</td>
                      <td className="px-6 py-4">
                        <select 
                          value={user.roleId} 
                          onChange={(e) => adminUpdateUserRole(user.id, e.target.value, user.secondaryRoleId)} 
                          className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white outline-none w-full" 
                          disabled={!hasPermission(currentUser, 'canManageRoles')}
                        >
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={user.secondaryRoleId || ''} 
                          onChange={(e) => adminUpdateUserRole(user.id, user.roleId, e.target.value || undefined)} 
                          className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white outline-none w-full" 
                          disabled={!hasPermission(currentUser, 'canManageRoles')}
                        >
                          <option value="">None</option>
                          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-4">{user.isBanned ? <span className="text-red-400 font-bold">{t('admin.banned')}</span> : <span className="text-green-400">{t('admin.active')}</span>}</td>
                      <td className="px-6 py-4">
                        {hasPermission(currentUser, 'canBanUsers') && user.id !== currentUser.id && (
                          <button onClick={() => banUser(user.id, !user.isBanned)} className={`px-3 py-1 rounded text-xs font-bold ${user.isBanned ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                            {user.isBanned ? t('admin.unban') : t('admin.ban')}
                          </button>
                        )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div ref={roleFormRef} className={`p-6 rounded-lg border transition-all ${editingRole ? 'bg-purple-900/10 border-purple-500 shadow-lg shadow-purple-900/20' : 'bg-gray-800 border-gray-700'}`}>
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  {editingRole ? <Pencil className="w-5 h-5 text-purple-400" /> : <Shield className="w-5 h-5 text-gray-400" />}
                  {editingRole ? 'Редактировать роль' : t('admin.createRole')}
               </h3>
               {editingRole && (
                 <div className="mb-4 text-xs text-purple-200 bg-purple-900/30 p-2 rounded border border-purple-800 flex items-center justify-between">
                    <span>Вы редактируете роль: <b>{editingRole.name}</b></span>
                    <button onClick={cancelEditRole} className="text-white bg-purple-800 px-2 py-0.5 rounded text-[10px] hover:bg-purple-700">Отмена</button>
                 </div>
               )}
               <form onSubmit={handleCreateOrUpdateRole} className="space-y-4">
                 <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder={t('admin.roleName')} required />
                 <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('admin.baseColor')}</label>
                    <input type="color" value={roleColor} onChange={e => setRoleColor(e.target.value)} className="w-full h-10 bg-gray-900 border border-gray-600 rounded p-1 cursor-pointer" />
                 </div>
                 <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('admin.visualEffect')}</label>
                    <select value={roleEffect} onChange={e => setRoleEffect(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white">
                        {ROLE_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}
                    </select>
                 </div>
                 
                 <div className="bg-gray-900 p-4 rounded border border-gray-700 space-y-2 max-h-60 overflow-y-auto grid grid-cols-1 gap-1">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2 sticky top-0 bg-gray-900 py-1">{t('admin.permissions')}</div>
                    {Object.keys(permissions).map(key => (
                      <label key={key} className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer hover:bg-white/5 p-2 rounded border border-transparent hover:border-gray-700 transition-colors">
                        <input type="checkbox" checked={permissions[key as keyof Permissions]} onChange={() => togglePermission(key as keyof Permissions)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-900" />
                        {key.replace(/can/g, '').replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                    ))}
                 </div>
                 
                 <div className="flex gap-2">
                    <button className="bg-purple-600 px-4 py-2 rounded text-white font-bold flex-1 hover:bg-purple-500 flex items-center justify-center gap-2">
                      {editingRole ? <Check className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      {editingRole ? t('general.save') : t('admin.createRole')}
                    </button>
                    {editingRole && (
                      <button type="button" onClick={cancelEditRole} className="bg-gray-700 px-4 py-2 rounded text-white hover:bg-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                 </div>
               </form>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
               <h3 className="text-xl font-bold text-white mb-4">{t('admin.existingRoles')}</h3>
               <div className="space-y-3">
                 {roles.map(r => (
                   <div key={r.id} className={`flex items-center justify-between bg-gray-900/50 p-3 rounded border ${editingRole?.id === r.id ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-gray-700'} transition-all`}>
                      <div className="flex items-center gap-3">
                        <RoleBadge role={r} />
                        {r.isDefault && <span className="text-[10px] font-bold bg-green-900 text-green-200 px-1.5 py-0.5 rounded border border-green-700">{t('admin.default')}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {!r.isDefault && (
                           <button 
                             onClick={() => adminSetDefaultRole(r.id)} 
                             className="text-xs font-bold text-gray-500 hover:text-white px-2 py-1 hover:bg-gray-700 rounded transition-colors mr-2"
                             title="Set as default role for new users"
                           >
                              {t('admin.makeDefault')}
                           </button>
                        )}
                        <button 
                          onClick={() => startEditRole(r)} 
                          className="text-blue-400 hover:text-white hover:bg-blue-600 p-1.5 rounded transition-all" 
                          title="Edit Role"
                        >
                           <Pencil className="w-4 h-4" />
                        </button>
                        {!r.isSystem && (
                          <button 
                            onClick={() => adminDeleteRole(r.id)} 
                            className="text-red-400 hover:text-white hover:bg-red-600 p-1.5 rounded transition-all"
                            title="Delete Role"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                   </div>
                 ))}
               </div>
            </div>
         </div>
      )}

      {activeTab === 'prefixes' && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
               <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Tag className="w-5 h-5" /> {t('admin.createPrefix')}</h3>
               <form onSubmit={handleCreatePrefix} className="space-y-4">
                 <input type="text" value={prefixText} onChange={e => setPrefixText(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder={t('admin.prefixText')} required />
                 <div>
                    <label className="text-xs text-gray-500 mb-1 block">{t('admin.prefixColor')}</label>
                    <input type="color" value={prefixColor} onChange={e => setPrefixColor(e.target.value)} className="w-full h-10 bg-gray-900 border border-gray-600 rounded p-1 cursor-pointer" />
                 </div>
                 <button className="bg-cyan-600 px-4 py-2 rounded text-white font-bold w-full hover:bg-cyan-500">{t('admin.createPrefix')}</button>
               </form>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
               <h3 className="text-xl font-bold text-white mb-4">{t('admin.existingPrefixes')}</h3>
               <div className="space-y-2">
                  {prefixes.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-900/50 p-3 rounded border border-gray-700">
                       <PrefixBadge prefixId={p.id} />
                       <button onClick={() => adminDeletePrefix(p.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default AdminPanel;