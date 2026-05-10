import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  return (
    <div className={'app-shell' + (collapsed ? ' is-collapsed' : '')}>
      <Header onBurger={() => setOpen((v) => !v)} />
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <Sidebar
        open={open}
        collapsed={collapsed}
        onCollapse={() => setCollapsed((v) => !v)}
      />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
