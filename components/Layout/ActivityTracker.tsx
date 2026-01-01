import React, { useEffect } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { useForum } from '../../context/ForumContext';

const ActivityTracker: React.FC = () => {
  const location = useLocation();
  const { currentUser, updateUserActivity, getForum, getThread } = useForum();

  useEffect(() => {
    if (!currentUser) return;

    const path = location.pathname;
    let type: any = 'viewing_index';
    let text = 'Просматривает главную страницу';
    let link = '/';

    // Check specific routes
    const threadMatch = matchPath('/thread/:id', path);
    const forumMatch = matchPath('/forum/:id', path);
    const userMatch = matchPath('/user/:id', path);
    const activityMatch = matchPath('/activity', path);
    const adminMatch = matchPath('/admin', path);

    if (adminMatch) {
       type = 'admin';
       text = 'В панели управления';
       link = '/admin';
    } else if (activityMatch) {
       type = 'viewing_index';
       text = 'Просматривает ленту активности';
       link = '/activity';
    } else if (threadMatch) {
       const thread = getThread(threadMatch.params.id || '');
       if (thread) {
          type = 'viewing_thread';
          text = `Читает тему "${thread.title}"`;
          link = path;
       }
    } else if (forumMatch) {
       const forum = getForum(forumMatch.params.id || '');
       if (forum) {
          type = 'viewing_forum';
          text = `Просматривает раздел "${forum.name}"`;
          link = path;
       }
    } else if (userMatch) {
       type = 'viewing_index';
       text = 'Просматривает профиль пользователя';
       link = path;
    }

    updateUserActivity({
        type,
        text,
        link,
        timestamp: new Date().toISOString()
    });

  }, [location, currentUser]); // Depend on location changes

  return null; // This component renders nothing
};

export default ActivityTracker;