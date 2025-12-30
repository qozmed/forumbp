import React, { useState } from 'react';
import { Post } from '../../types';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import { formatDate } from '../../utils/date';
import { parseBBCodeToHtml } from '../../utils/bbCodeParser';
import { Heart, Copy, CornerDownRight, Pencil, X, Check, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BBCodeEditor from '../UI/BBCodeEditor';
import RoleBadge from '../UI/RoleBadge';

interface Props {
  post: Post;
}

const PostItem: React.FC<Props> = ({ post }) => {
  const { getUser, currentUser, toggleLike, users, editPost, deletePost, getUserRoles, hasPermission, getThread } = useForum();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const author = getUser(post.authorId);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  if (!author) return null;
  
  const roles = getUserRoles(author);

  const copyContent = () => {
    const codeMatch = post.content.match(/\[code\]([\s\S]*?)\[\/code\]/);
    const contentToCopy = codeMatch ? codeMatch[1].trim() : post.content;
    
    navigator.clipboard.writeText(contentToCopy);
    alert(t('general.copyCode') + (codeMatch ? ' (Template extracted)' : ''));
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await editPost(post.id, editContent);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update post');
    }
  };

  const handleDelete = async () => {
    const isThreadStarter = post.number === 1;
    const confirmMsg = isThreadStarter 
      ? 'Deleting this post will delete the entire thread. Are you sure?' 
      : 'Are you sure you want to delete this post?';

    if (window.confirm(confirmMsg)) {
      try {
        await deletePost(post.id);
        if (isThreadStarter) {
           const thread = getThread(post.threadId);
           if (thread) {
             navigate(`/forum/${thread.forumId}`);
           } else {
             navigate('/');
           }
        }
      } catch (e: any) {
        alert(e.message || 'Failed to delete');
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(post.content);
  };

  const likedBy = post.likedBy || [];
  const likesCount = likedBy.length;
  const isLiked = currentUser && likedBy.includes(currentUser.id);
  const likedUsernames = likedBy.slice(0, 5).map(id => users[id]?.username).filter(Boolean).join(', ');
  const likeTooltip = likesCount > 0 ? `${t('general.likes')}: ${likedUsernames}${likesCount > 5 ? '...' : ''}` : '';
  
  // Permission Check
  const canEdit = currentUser && (
    (currentUser.id === post.authorId && hasPermission(currentUser, 'canEditOwnPosts')) ||
    hasPermission(currentUser, 'canEditAnyPost')
  );

  const canDelete = currentUser && (
    (currentUser.id === post.authorId && hasPermission(currentUser, 'canDeleteOwnPosts')) ||
    hasPermission(currentUser, 'canDeleteAnyPost')
  );

  return (
    <div className="glass-panel rounded mb-4 md:mb-6 overflow-hidden animate-fade-in bg-[#0d0d0d] border-[#222]" id={`post-${post.id}`}>
      
      {/* Mobile-Only Simplified Header (Replaces Sidebar) */}
      <div className="md:hidden p-3 border-b border-[#333] flex justify-between items-center bg-[#111]">
         <div className="flex items-center gap-3">
            <Link to={`/user/${author.id}`}>
               <img src={author.avatarUrl} className="w-9 h-9 rounded bg-[#222]" alt="" />
            </Link>
            <div className="flex flex-col">
               <Link to={`/user/${author.id}`} className="font-bold text-sm text-white flex items-center gap-2">
                  {author.username}
                  {roles[0] && <RoleBadge role={roles[0]} className="scale-75 origin-left" />}
               </Link>
               <span className="text-[10px] text-gray-500">{author.customTitle || roles[0]?.name}</span>
            </div>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-500">{formatDate(post.createdAt, language)}</span>
            <span className="text-[10px] text-[#333] font-mono">#{post.number}</span>
         </div>
      </div>

      <div className="flex flex-col md:flex-row min-h-[150px] md:min-h-[200px]">
        {/* Author Sidebar (Desktop Only) */}
        <div className="hidden md:flex w-56 bg-[#0a0a0a] p-6 flex-col items-center text-center border-r border-[#222] shrink-0">
          <Link to={`/user/${author.id}`} className="relative group mb-4 block">
             <img src={author.avatarUrl} className="relative w-24 h-24 rounded bg-[#111] border-2 border-[#333] shadow-lg object-cover transition-all duration-500" alt={author.username} />
          </Link>
          
          <Link to={`/user/${author.id}`} className="text-lg font-bold font-display text-white mb-1 tracking-wide hover:underline decoration-gray-600 underline-offset-4 transition-all">
             {author.username}
          </Link>
          <div className="text-xs text-gray-500 mb-4">{author.customTitle || roles[0]?.name}</div>
          
          {roles.length > 0 && (
             <div className="w-full mb-6 flex flex-col gap-1">
                {roles.map(role => (
                   <RoleBadge key={role.id} role={role} className="w-full py-1.5 px-2" />
                ))}
             </div>
          )}

          <div className="w-full space-y-2 text-xs text-gray-600 text-left px-2">
             <div className="flex justify-between border-b border-[#222] pb-1">
                <span>{t('user.messages')}</span>
                <span className="text-gray-400 font-mono">{author.messages}</span>
             </div>
             <div className="flex justify-between border-b border-[#222] pb-1">
                <span>{t('user.reactions')}</span>
                <span className="text-gray-400 font-mono">{author.reactions}</span>
             </div>
             <div className="flex justify-between">
                <span>{t('user.points')}</span>
                <span className="text-white font-mono">{author.points}</span>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d]">
          {/* Post Meta (Desktop Only) */}
          <div className="hidden md:flex h-10 border-b border-[#222] justify-between items-center text-xs text-gray-500 px-6 bg-[#111]">
             <span>{formatDate(post.createdAt, language)}</span>
             <a href={`#post-${post.id}`} className="hover:text-white font-mono transition-colors opacity-50 hover:opacity-100">#{post.number}</a>
          </div>

          {/* Body */}
          <div className="p-4 md:p-8 text-gray-300 text-sm leading-6 md:leading-7 min-h-[100px] md:min-h-[150px]">
             {isEditing ? (
                <div className="animate-in fade-in duration-200">
                  <BBCodeEditor 
                    value={editContent}
                    onChange={setEditContent}
                    className="h-40 mb-4"
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={handleCancelEdit} className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold text-gray-400 hover:text-white border border-[#333] hover:bg-[#222] transition-colors">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                    <button onClick={handleSaveEdit} className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold bg-white text-black hover:bg-gray-200 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Save Changes
                    </button>
                  </div>
                </div>
             ) : (
               <>
                 {post.content.includes('[code]') && (
                    <div className="mb-2 flex justify-end">
                       <button onClick={copyContent} className="text-xs flex items-center gap-1.5 text-white hover:text-gray-300 bg-[#222] px-2 py-1 rounded border border-[#333] transition-colors">
                          <Copy className="w-3 h-3" /> {t('general.copyCode')}
                       </button>
                    </div>
                 )}
                 <div dangerouslySetInnerHTML={{ __html: parseBBCodeToHtml(post.content) }} className="prose prose-invert max-w-none break-words" />
               </>
             )}
          </div>

          <div className="mt-auto">
            {/* Signature */}
            {!isEditing && author.signature && (
              <div className="mx-4 md:mx-6 mb-4 pt-4 border-t border-[#222]">
                <div 
                  className="text-xs text-gray-600 italic max-h-24 overflow-hidden opacity-70" 
                  dangerouslySetInnerHTML={{ __html: parseBBCodeToHtml(author.signature) }} 
                />
              </div>
            )}

            {/* Footer / Actions */}
            <div className="bg-[#0a0a0a] px-4 md:px-6 py-3 border-t border-[#222] flex flex-wrap gap-2 items-center justify-between">
               <div className="flex items-center gap-2 text-xs text-gray-400 min-h-[24px]" title={likeTooltip}>
                  {likesCount > 0 && (
                     <div className="flex items-center gap-2 bg-[#222] px-2 py-1 rounded border border-[#333]">
                        <Heart className="w-3 h-3 fill-white text-white" />
                        <span className="font-medium text-gray-300">{likesCount}</span>
                     </div>
                  )}
               </div>
               <div className="flex items-center gap-2 md:gap-4">
                  {canDelete && !isEditing && (
                    <button 
                      onClick={handleDelete}
                      className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-900/20 px-2 md:px-3 py-1.5 rounded transition-all"
                      title={post.number === 1 ? 'Delete Thread' : 'Delete Post'}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 
                      <span className="hidden md:inline">{post.number === 1 ? 'Thread' : 'Delete'}</span>
                    </button>
                  )}
                  {canEdit && !isEditing && (
                    <button 
                      onClick={() => { setIsEditing(true); setEditContent(post.content); }}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#222] px-2 md:px-3 py-1.5 rounded transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" /> <span className="hidden md:inline">Edit</span>
                    </button>
                  )}
                  <button 
                    onClick={() => toggleLike(post.id)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2 md:px-3 py-1.5 rounded transition-all ${
                      isLiked 
                        ? 'bg-white text-black border border-white' 
                        : 'text-gray-400 hover:text-white hover:bg-[#222]'
                    }`}
                  >
                     <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-black' : ''}`} /> 
                     <span className="hidden md:inline">{t('general.like')}</span>
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#222] px-2 md:px-3 py-1.5 rounded transition-all">
                     <CornerDownRight className="w-3.5 h-3.5" /> <span className="hidden md:inline">{t('general.quote')}</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostItem;