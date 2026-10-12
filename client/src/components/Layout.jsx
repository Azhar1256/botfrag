import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import useFetch from '../lib/useFetch.js';
import { gameGradient, plural } from '../lib/format.js';
import Icon from './Icon.jsx';
import { Avatar, Score } from './ui.jsx';

function SearchBox() {
  const navigate = useNavigate();
  const { search, pathname } = useLocation();
  const current = pathname === '/search' ? new URLSearchParams(search).get('q') ?? '' : '';
  const [q, setQ] = useState(current);
  useEffect(() => {
    setQ(current);
  }, [current]);

  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Icon name="search" size={18} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts, games, tags" aria-label="Search" />
    </form>
  );
}

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="menu__trigger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu">
        <Avatar user={user} size={36} />
      </button>
      {open && (
        <div className="menu__panel">
          <div className="menu__who">
            <strong>{user.displayName}</strong>
            <span className="muted">@{user.username}</span>
          </div>
          <Link to={`/u/${user.username}`}><Icon name="users" size={16} />Your profile</Link>
          <Link to="/settings"><Icon name="settings" size={16} />Edit profile</Link>
          <button type="button" onClick={logout}><Icon name="logout" size={16} />Sign out</button>
        </div>
      )}
    </div>
  );
}

const NAV = [
  ['/', 'home', 'Home', true],
  ['/following', 'users', 'Following'],
  ['/moments', 'clip', 'Moments'],
  ['/reviews', 'star', 'Reviews'],
  ['/games', 'gamepad', 'Games'],
];

function Sidebar() {
  const games = useFetch('/games?limit=6');
  const tags = useFetch('/tags/trending');

  return (
    <aside className="rail rail--right">
      <section className="card panel">
        <h3 className="panel__title"><Icon name="flame" size={18} />Top games</h3>
        {games.data?.games.length ? (
          <ul className="game-list">
            {games.data.games.map((g) => (
              <li key={g.slug}>
                <Link to={`/games/${g.slug}`}>
                  <span className="game-list__thumb" style={{ background: g.cover ? `center/cover url(${g.cover})` : gameGradient(g.slug) }} />
                  <span className="game-list__name">
                    {g.name}
                    <small className="muted">{plural(g.posts, 'post')}</small>
                  </span>
                  {g.avgRating != null && <Score rating={g.avgRating} size="sm" />}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No games yet. Be the first to post.</p>
        )}
        <Link to="/games" className="panel__more">All games</Link>
      </section>

      {tags.data?.tags.length > 0 && (
        <section className="card panel">
          <h3 className="panel__title"><Icon name="hash" size={18} />Trending tags</h3>
          <div className="tag-cloud">
            {tags.data.tags.map((t) => (
              <Link key={t.tag} to={`/tags/${t.tag}`} className="chip">#{t.tag}</Link>
            ))}
          </div>
        </section>
      )}
      <p className="muted small footer-note">Botfrag · share the plays, rate the games.</p>
    </aside>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand" aria-label="Botfrag home">
            <img src="/logo.png" alt="" width="34" height="34" />
            <span>BOTFRAG</span>
          </Link>
          <SearchBox />
          <div className="topbar__actions">
            {user ? (
              <>
                <Link to="/new" className="btn btn--primary btn--sm">
                  <Icon name="plus" size={18} />
                  <span className="hide-sm">Post</span>
                </Link>
                <UserMenu user={user} logout={() => { logout(); navigate('/'); }} />
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">Sign in</Link>
                <Link to="/signup" className="btn btn--primary btn--sm hide-xs">Join</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="shell">
        <nav className="rail rail--left" aria-label="Main">
          {NAV.map(([to, icon, label, end]) => (
            <NavLink key={to} to={to} end={end} className="nav-item">
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          {user && (
            <Link to="/new" className="btn btn--primary btn--block rail__cta">
              <Icon name="plus" size={18} />
              Create post
            </Link>
          )}
        </nav>

        <main className="main">
          <Outlet />
        </main>

        <Sidebar />
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {NAV.map(([to, icon, label, end]) => (
          <NavLink key={to} to={to} end={end}>
            <Icon name={icon} size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
