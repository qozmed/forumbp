import React from 'react';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import { MessageSquare, Users, Award, BarChart2, TrendingUp } from 'lucide-react';
import { timeAgo } from '../../utils/date';
import { User } from '../../types';
import { Link } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const { forums, users, threads } = useForum();
  const { t, language } = useLanguage();

  // Calculate stats
  const totalThreads = forums.reduce((acc, f) => acc + f.threadCount, 0);
  const totalMessages = forums.reduce((acc, f) => acc + f.messageCount, 0);
  const totalUsers = Object.keys(users).length;

  // Mock latest activity
  const recentThreads = threads.slice(0, 5);

  return (
    <aside className="w-full lg:w-80 flex flex-col gap-6 animate-fade-in">
      
      {/* Latest Posts Widget */}
      <div className="glass-panel rounded overflow-hidden">
        <div className="px-5 py-3 border-b border-[#333] flex items-center gap-3 bg-[#111]">
          <TrendingUp className="w-4 h-4 text-white" />
          <h3 className="font-bold text-xs uppercase tracking-wider font-display text-gray-300">{t('sidebar.latestMessages')}</h3>
        </div>
        <div className="p-2 bg-[#0d0d0d]">
          {recentThreads.map(thread => {
            const author = users[thread.authorId];
            return (
              <div key={thread.id} className="group flex gap-3 items-start p-3 rounded hover:bg-[#1a1a1a] transition-all">
                <Link to={`/user/${thread.authorId}`} className="shrink-0">
                   <img src={author?.avatarUrl} className="w-8 h-8 rounded bg-[#222] border border-[#333] transition-all hover:scale-110" alt="" />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="mb-0.5">
                    <Link to={`/thread/${thread.id}`} className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors truncate block font-display">
                      {thread.title}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-600 flex items-center gap-1">
                    <Link to={`/user/${thread.authorId}`} className="text-gray-500 hover:text-white transition-colors">{author?.username}</Link>
                    <span>&bull;</span>
                    {timeAgo(thread.createdAt, language)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Widget */}
      <div className="glass-panel rounded overflow-hidden">
        <div className="px-5 py-3 border-b border-[#333] flex items-center gap-3 bg-[#111]">
          <Award className="w-4 h-4 text-white" />
          <h3 className="font-bold text-xs uppercase tracking-wider font-display text-gray-300">{t('sidebar.topUsers')}</h3>
        </div>
        <div className="p-2 bg-[#0d0d0d]">
          {(Object.values(users) as User[])
            .sort((a, b) => b.points - a.points)
            .slice(0, 5)
            .map((user, idx) => (
              <div key={user.id} className="flex items-center gap-3 p-3 rounded hover:bg-[#1a1a1a] transition-colors">
                 <div className={`w-6 text-center text-sm font-bold font-display ${idx === 0 ? 'text-white' : 'text-gray-600'}`}>
                   #{idx + 1}
                 </div>
                 <Link to={`/user/${user.id}`} className="shrink-0">
                    <img src={user.avatarUrl} className="w-8 h-8 rounded bg-[#222] transition-all hover:scale-110" alt="" />
                 </Link>
                 <div className="flex-1">
                    <Link to={`/user/${user.id}`} className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">{user.username}</Link>
                 </div>
                 <div className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">{user.points}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Stats Widget */}
      <div className="glass-panel rounded overflow-hidden">
        <div className="px-5 py-3 border-b border-[#333] flex items-center gap-3 bg-[#111]">
          <BarChart2 className="w-4 h-4 text-white" />
          <h3 className="font-bold text-xs uppercase tracking-wider font-display text-gray-300">{t('sidebar.stats')}</h3>
        </div>
        <div className="p-5 space-y-4 bg-[#0d0d0d]">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> {t('sidebar.threads')}</span>
            <span className="font-mono text-white font-bold">{totalThreads.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> {t('sidebar.messages')}</span>
            <span className="font-mono text-white font-bold">{totalMessages.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2 border-t border-[#222]">
            <span className="text-gray-500 flex items-center gap-2"><Users className="w-4 h-4" /> {t('sidebar.members')}</span>
            <span className="font-mono text-white font-bold">{totalUsers.toLocaleString()}</span>
          </div>
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;