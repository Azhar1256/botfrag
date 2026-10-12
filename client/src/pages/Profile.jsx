import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Feed from '../components/Feed.jsx';
import BrandIcon from '../components/BrandIcon.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, Empty, Spinner, Tabs } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { compact, hueOf, slugifyGame } from '../lib/format.js';
import useFetch from '../lib/useFetch.js';

export default function Profile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, setData } = useFetch(`/users/${username}`);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <Empty icon="users" title="Player not found"><p className="muted">No one goes by @{username} here.</p></Empty>;

  const { user, stats } = data;
  const isMe = me?.id === user.id;

  const follow = async () => {
    if (!me) return navigate('/login');
    setBusy(true);
    try {
      const res = await api(`/users/${user.username}/follow`, { method: 'POST' });
      setData((d) => ({ ...d, user: res.user }));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const h = hueOf(user.username);

  return (
    <>
      <section className="card profile">
        <div className="profile__banner" style={{ background: `linear-gradient(120deg, hsl(${h} 60% 22%), hsl(${(h + 40) % 360} 70% 12%) 60%, #0b0c10)` }} />
        <div className="profile__body">
          <div className="profile__top">
            <Avatar user={user} size={96} />
            {isMe ? (
              <Link to="/settings" className="btn btn--ghost btn--sm"><Icon name="edit" size={16} />Edit profile</Link>
            ) : (
              <button type="button" className={`btn btn--sm ${user.isFollowing ? 'btn--ghost' : 'btn--primary'}`} onClick={follow} disabled={busy}>
                {user.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          <h1>{user.displayName}</h1>
          <p className="muted">@{user.username}</p>
          {user.bio && <p className="profile__bio">{user.bio}</p>}

          <div className="profile__chips">
            {user.steamId && (
              <a className="chip chip--steam" href={`https://steamcommunity.com/profiles/${user.steamId}`} target="_blank" rel="noreferrer">
                <BrandIcon name="steam" size={13} />
                {user.connections.steam}
              </a>
            )}
            {user.platforms.map((p) => <span key={p} className="chip chip--plain">{p}</span>)}
            {user.favoriteGames.map((g) => (
              <Link key={g} to={`/games/${slugifyGame(g)}`} className="chip chip--game"><Icon name="gamepad" size={14} />{g}</Link>
            ))}
          </div>

          <dl className="stats">
            <div><dt>Moments</dt><dd>{compact(stats.moments)}</dd></div>
            <div><dt>Reviews</dt><dd>{compact(stats.reviews)}</dd></div>
            <div><dt>Likes</dt><dd>{compact(stats.likesReceived)}</dd></div>
            <div><dt>Followers</dt><dd>{compact(user.followerCount)}</dd></div>
            <div><dt>Following</dt><dd>{compact(user.followingCount)}</dd></div>
          </dl>
        </div>
      </section>

      <div className="page-head">
        <Tabs items={[['all', 'All posts'], ['moment', 'Moments'], ['review', 'Reviews']]} value={tab} onChange={setTab} />
      </div>
      <Feed
        params={{ author: user.username, type: tab === 'all' ? undefined : tab }}
        empty={
          <Empty title={isMe ? 'You have not posted yet' : `${user.displayName} has not posted yet`}>
            {isMe && <Link to="/new" className="btn btn--primary">Create your first post</Link>}
          </Empty>
        }
      />
    </>
  );
}
