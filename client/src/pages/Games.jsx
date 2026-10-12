import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Feed from '../components/Feed.jsx';
import Icon from '../components/Icon.jsx';
import { Empty, ErrorBox, Score, Spinner, Tabs } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';
import { gameGradient, plural, timeAgo } from '../lib/format.js';
import useFetch from '../lib/useFetch.js';
import { SortBar, useSort } from './Home.jsx';

const cover = (g) => (g.cover ? `center/cover no-repeat url(${g.cover}), ${gameGradient(g.slug)}` : gameGradient(g.slug));

export function GamesPage() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading } = useFetch(`/games?limit=100${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Games</h1>
          <p className="muted">Every game the community is talking about.</p>
        </div>
        <input className="input input--sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter games" aria-label="Filter games" />
      </div>
      <ErrorBox error={error} />
      {loading && !data && <Spinner />}
      {data?.games.length === 0 && <Empty title={debounced ? `No games match “${debounced}”` : 'No games yet'} />}
      <div className="game-grid">
        {data?.games.map((g) => (
          <Link key={g.slug} to={`/games/${g.slug}`} className="game-card">
            <div className="game-card__art" style={{ background: cover(g) }}>
              {g.avgRating != null && <Score rating={g.avgRating} size="sm" />}
            </div>
            <div className="game-card__info">
              <strong>{g.name}</strong>
              <span className="muted small">{plural(g.moments, 'moment')} · {plural(g.reviews, 'review')}</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function GamePage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const type = params.get('type') || 'all';
  const sort = useSort();
  const { data, error, loading } = useFetch(`/games/${slug}`);

  if (loading) return <Spinner />;
  if (error) return <Empty title="No posts about this game yet"><p className="muted">{error.message}</p></Empty>;
  const g = data.game;
  const m = g.meta;
  const max = Math.max(1, ...g.distribution);

  return (
    <>
      <section className="game-hero card">
        <div
          className="game-hero__backdrop"
          style={{ background: m?.screenshots?.[0] ? `center/cover url(${m.screenshots[0]})` : cover(g) }}
        />
        <div className="game-hero__content">
          <div className="game-hero__art" style={{ background: cover(g) }} />
          <div className="game-hero__info">
            <h1>{g.name}</h1>
            <p className="game-hero__facts">
              {m?.releaseDate && <span>{new Date(m.releaseDate).getUTCFullYear()}</span>}
              {m?.platforms.length > 0 && <span>{m.platforms.slice(0, 5).join(' · ')}</span>}
            </p>
            {m?.genres.length > 0 && (
              <div className="tag-cloud">
                {m.genres.map((x) => <span key={x} className="chip chip--plain">{x}</span>)}
              </div>
            )}
            {m?.summary && <p className="game-hero__summary">{m.summary}</p>}
            <p className="game-hero__stats">
              {plural(g.posts, 'post')} · {plural(g.likes, 'like')} · active {timeAgo(g.lastActivity) === 'now' ? 'just now' : `${timeAgo(g.lastActivity)} ago`}
              {m?.igdbRating != null && <> · IGDB {m.igdbRating}/100</>}
            </p>
            {m && (m.igdbId || m.giantBombUrl) && (
              <p className="muted small">
                Game info from{' '}
                {m.igdbId && <a href="https://www.igdb.com" target="_blank" rel="noreferrer">IGDB.com</a>}
                {m.igdbId && m.giantBombUrl && ' and '}
                {m.giantBombUrl && <a href={m.giantBombUrl} target="_blank" rel="noreferrer">Giant Bomb</a>}
              </p>
            )}
            {user && (
              <div className="game-hero__cta">
                <Link to={`/new?game=${encodeURIComponent(g.name)}`} className="btn btn--primary btn--sm"><Icon name="clip" size={16} />Share a moment</Link>
                <Link to={`/new?type=review&game=${encodeURIComponent(g.name)}`} className="btn btn--ghost btn--sm"><Icon name="star" size={16} />Review it</Link>
                {m?.giantBombUrl && (
                  <a href={m.giantBombUrl} target="_blank" rel="noreferrer" className="btn btn--text btn--sm"><Icon name="link" size={16} />More on Giant Bomb</a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {g.reviews > 0 && (
        <section className="card rating-summary">
          <div className="rating-summary__score">
            <Score rating={g.avgRating} size="lg" />
            <span className="muted small">from {g.reviews} review{g.reviews === 1 ? '' : 's'}</span>
          </div>
          <div className="histogram" aria-label="Score distribution">
            {g.distribution.map((n, i) => (
              <div key={i} className="histogram__col" title={`${n} × ${i + 1}/10`}>
                <span style={{ height: `${(n / max) * 100}%` }} className={n ? 'has' : ''} />
                <small>{i + 1}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="page-head">
        <Tabs
          items={[['all', 'All'], ['moment', 'Moments'], ['review', 'Reviews']]}
          value={type}
          onChange={(v) => {
            const next = new URLSearchParams(params);
            if (v === 'all') next.delete('type');
            else next.set('type', v);
            setParams(next, { replace: true });
          }}
        />
        <SortBar />
      </div>
      <Feed params={{ ...sort, game: slug, type: type === 'all' ? undefined : type }} />
    </>
  );
}
