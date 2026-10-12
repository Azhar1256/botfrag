import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { compact, timeAgo } from '../lib/format.js';
import BrandIcon from './BrandIcon.jsx';
import Icon from './Icon.jsx';
import Media from './Media.jsx';
import { Avatar, Score, TypeBadge, UserLink } from './ui.jsx';

export function LikeButton({ post, onChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user) return navigate('/login');
    setBusy(true);
    // Optimistic update, rolled back if the request fails.
    const prev = { liked: post.liked, likeCount: post.likeCount };
    onChange({ liked: !prev.liked, likeCount: prev.likeCount + (prev.liked ? -1 : 1) });
    try {
      onChange(await api(`/posts/${post.id}/like`, { method: 'POST' }));
    } catch {
      onChange(prev);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className={`action ${post.liked ? 'action--liked' : ''}`} onClick={toggle} disabled={busy} aria-pressed={post.liked}>
      <Icon name="heart" filled={post.liked} size={18} />
      {compact(post.likeCount)}
      <span className="sr-only">likes</span>
    </button>
  );
}

export function ShareButton({ post }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* share sheet dismissed */
    }
  };
  return (
    <button type="button" className="action" onClick={share}>
      <Icon name={copied ? 'check' : 'link'} size={18} />
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}

const hoursLabel = (h) => (h >= 100 ? Math.round(h).toLocaleString() : h < 1 ? '<1' : h.toFixed(h % 1 ? 1 : 0));

// Playtime the server read from the author's Steam library when they posted.
export function SteamPlaytime({ steam }) {
  if (!steam) return null;
  return (
    <a
      className="chip chip--steam"
      href={`https://store.steampowered.com/app/${steam.appid}`}
      target="_blank"
      rel="noreferrer"
      title="Verified from the author's Steam library when they posted"
    >
      <BrandIcon name="steam" size={13} />
      {hoursLabel(steam.hours)} hrs on Steam
    </a>
  );
}

export function PostByline({ post }) {
  return (
    <div className="byline">
      <Link to={`/u/${post.author.username}`} tabIndex={-1}>
        <Avatar user={post.author} size={40} />
      </Link>
      <div className="byline__text">
        <UserLink user={post.author} />
        <span className="muted">
          @{post.author.username} · <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
          {post.platform && <> · {post.platform}</>}
        </span>
      </div>
      <TypeBadge type={post.type} />
    </div>
  );
}

export default function PostCard({ post: initial }) {
  const [post, setPost] = useState(initial);
  if (!post.author) return null;

  return (
    <article className={`card post-card post-card--${post.type}`}>
      <PostByline post={post} />

      <Link to={`/p/${post.id}`} className="post-card__main">
        <div className="post-card__head">
          <h2 className="post-card__title">{post.title}</h2>
          {post.type === 'review' && <Score rating={post.rating} />}
        </div>
        {post.body && <p className="post-card__body">{post.body}</p>}
      </Link>

      <Media items={post.media} />

      <div className="post-card__meta">
        <Link to={`/games/${post.game.slug}`} className="chip chip--game">
          <Icon name="gamepad" size={14} />
          {post.game.name}
        </Link>
        <SteamPlaytime steam={post.steam} />
        {post.tags.slice(0, 4).map((t) => (
          <Link key={t} to={`/tags/${t}`} className="chip">#{t}</Link>
        ))}
      </div>

      <footer className="actions">
        <LikeButton post={post} onChange={(patch) => setPost((p) => ({ ...p, ...patch }))} />
        <Link to={`/p/${post.id}#comments`} className="action">
          <Icon name="comment" size={18} />
          {compact(post.commentCount)}
          <span className="sr-only">comments</span>
        </Link>
        <ShareButton post={post} />
      </footer>
    </article>
  );
}
