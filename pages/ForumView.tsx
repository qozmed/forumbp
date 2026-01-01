import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, ChevronRight, Plus, Lock, Pin } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import PrefixBadge from '../components/UI/PrefixBadge';
import CreateThreadModal from '../components/Forum/CreateThreadModal';
import ForumRow from '../components/Forum/ForumRow';
import Pagination from '../components/UI/Pagination';
import { timeAgo } from '../utils/date';

const ForumView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getForum, getSubForums, threads, users, currentUser, hasPermission } = useForum();
  const { t, language } = useLanguage();
  const [isCreateOpen, setCreateOpen] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const forum = id ? getForum(id) : undefined;
  
  if (!forum) {
    return <div className="text-center text-white py-20">Forum not found</div>;
  }

  // Get Sub-forums
  const subForums = getSubForums(forum.id);

  // Filter threads and Pagination logic
  // Sorting: 
  // 1. Pinned
  // 2. Manual Order (Ascending - 0 is default/first, but usually higher number means lower in list if implementing drag/drop, but here we act as index)
  //    Actually AdminPanel usually moves Up/Down. Let's assume lower 'order' is higher in list (like array index).
  // 3. Creation Date (Newest First)
  const forumThreads = threads
    .filter(t => t.forumId === forum.id)
    .sort((a, b) => {
      // 1. Priority to Pinned threads
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // 2. Manual Order (if set and different)
      // We only use manual order if it's explicitly set (not 0) or if we want strict ordering
      // Let's make manual order take precedence if they differ
      if ((a.order || 0) !== (b.order || 0)) {
         return (a.order || 0) - (b.order || 0);
      }
      
      // 3. Sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalPages = Math.ceil(forumThreads.length / itemsPerPage);
  const currentThreads = forumThreads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const canManageForums = hasPermission(currentUser, 'canManageForums');
  // Users can create threads if they have permission AND forum is not closed (or they are admin)
  const canCreateThread = hasPermission(currentUser, 'canCreateThread') && (!forum.isClosed || canManageForums);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-white"><Home className="w-4 h-4" /></Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/" className="hover:text-white">{t('nav.forums')}</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-300">{forum.name}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
           
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <h1 className="text-3xl font-bold font-display text-white">{forum.name}</h1>
               {forum.isClosed && (
                 <span className="px-2 py-1 rounded bg-red-900/30 border border-red-800 text-red-200 text-xs font-bold flex items-center gap-1">
                   <Lock className="w-3 h-3" /> CLOSED
                 </span>
               )}
             </div>
             {canCreateThread ? (
               <button 
                 onClick={() => setCreateOpen(true)}
                 className="flex items-center gap-2 px-5 py-2 bg-white text-black hover:bg-gray-200 font-bold rounded shadow transition-all"
               >
                 <Plus className="w-4 h-4" /> {t('thread.create')}
               </button>
             ) : (
                forum.isClosed && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded cursor-not-allowed">
                     <Lock className="w-4 h-4" /> Forum Locked
                  </div>
                )
             )}
           </div>

           {/* SUB-FORUMS SECTION */}
           {subForums.length > 0 && (
              <div className="mb-8 animate-fade-in">
                 <div className="bg-[#1a1a1a] border border-[#333] rounded overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#333] flex items-center gap-2">
                       <span className="text-xs text-gray-200 uppercase font-bold tracking-wider">{t('forum.subforums')}</span>
                    </div>
                    <div>
                       {subForums.map(sf => (
                          <ForumRow key={sf.id} forum={sf} />
                       ))}
                    </div>
                 </div>
              </div>
           )}

           <div className="glass-panel rounded overflow-hidden animate-fade-in bg-[#0d0d0d]">
              <div className="px-5 py-4 bg-[#1a1a1a] border-b border-[#333] flex justify-between text-xs text-gray-400 uppercase font-bold tracking-wider">
                 <span>{t('forum.threads')}</span>
                 <div className="hidden md:flex gap-16 mr-8">
                    <span className="w-16 text-center">{t('sidebar.stats')}</span>
                    <span className="w-32">{t('forum.lastPost')}</span>
                 </div>
              </div>

              {forumThreads.length === 0 ? (
                <div className="p-12 text-center text-gray-600 italic">
                   {t('forum.empty')}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[#222]">
                     {currentThreads.map(thread => {
                       const author = users[thread.authorId];
                       const lastPoster = thread.lastPost ? users[thread.lastPost.authorId] : null;
                       const hasNewActivity = thread.lastPost && (Date.now() - new Date(thread.lastPost.createdAt).getTime() < 24 * 60 * 60 * 1000);

                       return (
                         <div key={thread.id} className={`p-4 flex items-center gap-5 hover:bg-[#161616] transition-colors ${thread.isPinned ? 'bg-[#1a1a1a]/50 border-l-2 border-l-green-500' : ''}`}>
                            <div className="flex-shrink-0 relative">
                               <img 
                                 src={author?.avatarUrl} 
                                 className={`w-10 h-10 rounded bg-[#222] ${hasNewActivity ? '' : 'opacity-60'}`} 
                                 alt="" 
                               />
                               {hasNewActivity && (
                                 <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded border border-black shadow"></div>
                               )}
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 {/* Pin/Lock Icons */}
                                 {thread.isPinned && <Pin className="w-3.5 h-3.5 text-green-400 fill-green-400 rotate-45" />}
                                 {thread.isLocked && <Lock className="w-3.5 h-3.5 text-red-500" />}
                                 
                                 <Link to={`/thread/${thread.id}`} className={`text-base font-bold font-display transition-colors truncate ${hasNewActivity ? 'text-white hover:text-gray-300' : 'text-gray-400 hover:text-gray-200'}`}>
                                    <PrefixBadge prefixId={thread.prefixId} />
                                    {thread.title}
                                 </Link>
                               </div>
                               <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                  {t('forum.startedBy')} <span className="text-gray-400 font-medium">{author?.username}</span> &bull; {timeAgo(thread.createdAt, language)}
                               </div>
                            </div>

                            <div className="hidden md:flex flex-col w-24 text-center">
                               <span className={`text-sm font-mono ${hasNewActivity ? 'text-gray-200' : 'text-gray-600'}`}>{thread.replyCount}</span>
                               <span className="text-[10px] text-gray-600 uppercase tracking-wider">{t('forum.replies')}</span>
                            </div>

                            <div className="hidden md:block w-48 text-right text-xs">
                               {thread.lastPost ? (
                                 <>
                                   <div className={`mb-0.5 ${hasNewActivity ? 'text-gray-300' : 'text-gray-600'}`}>{timeAgo(thread.lastPost.createdAt, language)}</div>
                                   <div className="text-gray-500">{t('forum.by')} <span className={`font-medium ${hasNewActivity ? 'text-white' : 'text-gray-500'}`}>{lastPoster?.username || 'Unknown'}</span></div>
                                 </>
                               ) : (
                                 <span>-</span>
                               )}
                            </div>
                         </div>
                       );
                     })}
                  </div>
                  
                  {/* Pagination Control */}
                  <div className="p-4 border-t border-[#333]">
                     <Pagination 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                     />
                  </div>
                </>
              )}
           </div>
        </div>

        <div className="hidden lg:block lg:w-80">
          <Sidebar />
        </div>
      </div>

      <CreateThreadModal forumId={forum.id} isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default ForumView;