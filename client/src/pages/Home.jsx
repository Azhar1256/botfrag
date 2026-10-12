import { Link, useSearchParams } from 'react-router-dom';
import Feed from '../components/Feed.jsx';
import { Empty, Tabs } from '../components/ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const SORTS = [['latest', 'Latest'], ['top', 'Top']];
const PERIODS = [['week', 'This week'], ['month', 'This month'], ['all', 'All time']];

export function SortBar() {
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') || 'latest';
  const period = params.get('period') || 'week';
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };

  return (
    <div className="sortbar">
      <Tabs items={SORTS} value={sort} onChange={(v) => set('sort', v)} />
      {sort === 'top' && (
        <select value={period} onChange={(e) => set('period', e.target.value)} aria-label="Time range" className="select select--sm">
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      )}
    </div>
  );
}

export const useSort = () => {
  const [params] = useSearchParams();
  const sort = params.get('sort') || 'latest';
  return { sort, period: sort === 'top' ? params.get('period') || 'week' : undefined };
};

const HEADINGS = {
  all: ['Home', 'The latest plays and verdicts from every player.'],
  following: ['Following', 'Posts from players you follow.'],
  moment: ['Moments', 'Clutches, aces, fails and screenshots worth sharing.'],
  review: ['Reviews', 'Honest scores from people who actually played.'],
};

export default function Home({ view = 'all' }) {
  const { user } = useAuth();
  const sort = useSort();
  const [title, sub] = HEADINGS[view];

  const params = {
    ...sort,
    type: view === 'moment' || view === 'review' ? view : undefined,
    feed: view === 'following' ? 'following' : undefined,
  };

  return (
    <>
      {view === 'all' && !user && (
        <section className="hero card">
          <img src="/logo.png" alt="" width="88" height="88" />
          <div>
            <h1>Your best plays deserve an audience.</h1>
            <p>Post clips and screenshots of your clutch moments, write honest game reviews, and follow players you rate.</p>
            <div className="hero__cta">
              <Link to="/signup" className="btn btn--primary">Create your account</Link>
              <Link to="/games" className="btn btn--ghost">Browse games</Link>
            </div>
          </div>
        </section>
      )}

      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{sub}</p>
        </div>
        <SortBar />
      </div>

      {view === 'following' && !user ? (
        <Empty icon="users" title="Sign in to see your following feed">
          <Link to="/login" className="btn btn--primary">Sign in</Link>
        </Empty>
      ) : (
        <Feed
          params={params}
          empty={
            view === 'following' ? (
              <Empty icon="users" title="Your feed is quiet">
                <p className="muted">Follow players from their profile pages and their posts land here.</p>
              </Empty>
            ) : (
              <Empty title="No posts yet">
                {user && <Link to="/new" className="btn btn--primary">Share the first one</Link>}
              </Empty>
            )
          }
        />
      )}
    </>
  );
}
