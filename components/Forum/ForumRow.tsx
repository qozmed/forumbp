import React from 'react';
import { Forum } from '../../types';
import { MessageCircle, Users, BookOpen, Scale, Megaphone } from 'lucide-react';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import { timeAgo } from '../../utils/date';
import { Link } from 'react-router-dom';

interface Props {
  forum: Forum;
}

const ForumRow: React.FC<Props> = ({ forum }) => {
  const { getUser, getSubForums } = useForum();
  const { t, language } = useLanguage();

  // Dynamic icon renderer
  const getIcon = (name: string) => {
    switch (name) {
      case 'BookOpen': return <BookOpen className="w-5 h-5" />;
      case 'Megaphone': return <Megaphone className="w-5 h-5" />;
      case 'Scale': return <Scale className="w-5 h-5" />;
      case 'Users': return <Users className="w-5 h-5" />;
      default: return <MessageCircle className="w-5 h-5" />;
    }
  };

  const lastPostAuthor = forum.lastPost ? getUser(forum.lastPost.authorId) : null;
  const subForums = getSubForums(forum.id);
  
  // Check if forum has recent activity (last 24h)
  const hasNewActivity = forum.lastPost && (Date.now() - new Date(forum.lastPost.createdAt).getTime() < 24 * 60 * 60 * 1000);

  return (
    <div className="group flex items-center gap-5 p-5 border-b border-[#222] hover:bg-[#161616] transition-colors last:border-0 relative overflow-hidden">
      
      {/* Icon - White/Gray */}
      <div className={`flex-shrink-0 w-10 h-10 rounded flex items-center justify-center transition-all duration-300 ${
        hasNewActivity 
          ? 'bg-white text-black' 
          : 'bg-[#222] text-gray-500'
      }`}>
        {getIcon(forum.icon)}
      </div>
      
      <div className="flex-1 min-w-0">
        <Link to={`/forum/${forum.id}`} className={`text-lg font-bold font-display transition-colors ${hasNewActivity ? 'text-white hover:text-gray-300' : 'text-gray-400 hover:text-gray-200'}`}>
          {forum.name}
        </Link>
        <p className="text-sm text-gray-500 mt-1 line-clamp-1 font-light">{forum.description}</p>
        {subForums && subForums.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {subForums.map(sf => (
               <Link to={`/forum/${sf.id}`} key={sf.id} className="text-xs text-gray-500 hover:text-white cursor-pointer transition-colors bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#333]">
                 {sf.name}
               </Link>
            ))}
          </div>
        )}
      </div>

      <div className="hidden md:flex flex-col items-center w-24">
        <span className="text-lg font-mono text-gray-300">{forum.threadCount.toLocaleString()}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-600">{t('forum.threads')}</span>
      </div>

      <div className="w-72 hidden lg:flex items-center gap-3 pl-6 border-l border-[#222]">
        {forum.lastPost ? (
          <>
            <Link to={`/user/${lastPostAuthor?.id}`}>
               <img src={lastPostAuthor?.avatarUrl} className="w-9 h-9 rounded bg-[#222] transition-all hover:scale-105" alt="" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/thread/${forum.lastPost.threadId}`} className="block text-sm font-medium truncate text-gray-400 hover:text-white transition-colors mb-0.5">
                 {forum.lastPost.threadTitle}
              </Link>
              <div className="text-xs text-gray-600">
                <Link to={`/user/${lastPostAuthor?.id}`} className="text-gray-500 hover:text-white transition-colors">{lastPostAuthor?.username}</Link>
                <span className="mx-1">&bull;</span>
                {timeAgo(forum.lastPost.createdAt, language)}
              </div>
            </div>
          </>
        ) : (
          <span className="text-gray-700 text-sm italic opacity-50">{t('forum.noPosts')}</span>
        )}
      </div>
    </div>
  );
};

export default ForumRow;