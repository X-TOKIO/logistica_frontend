import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

export const Layout = () => {
  return (
    <div className="min-h-screen flex text-text bg-background font-sans transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 min-h-screen relative">
        <Header />
        <main className="flex-1 px-6 pb-6 pt-[88px] z-0">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};
