import React from 'react';
import { useForum } from '../context/ForumContext';
import CategoryBlock from '../components/Forum/CategoryBlock';
import Sidebar from '../components/Layout/Sidebar';

const Home: React.FC = () => {
  const { categories } = useForum();

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">
        {categories.map(category => (
          <CategoryBlock key={category.id} category={category} />
        ))}
      </div>
      <Sidebar />
    </div>
  );
};

export default Home;
