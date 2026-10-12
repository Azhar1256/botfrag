import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Media from '../components/Media.jsx';
import { LikeButton, PostByline, ShareButton, SteamPlaytime } from '../components/PostCard.jsx';
import { Avatar, Empty, ErrorBox, Score, Spinner, UserLink } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fullDate, scoreTone, timeAgo } from '../lib/format.js';
import useFetch from '../lib/useFetch.js';

const VERDICT = { great: 'Great', mixed: 'Mixed', poor: 'Poor' };

function Comments({ post, onCount }) {
  const { user } = useAuth();
  const { data, error, loading, setData } = useFetch(`/posts/${post.id}/comments`);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const { comment } = await api(`/posts/${post.id}/comments`, { method: 'POST', body: { body } });
      setData((d) => ({ comments: [...(d?.comments ?? []), comment] }));
      onCount(1);
      setBody('');
    } catch (err) {
      setSendError(err);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    await api(`/posts/${post.id}/comments/${id}`, { method: 'DELETE' });
    setData((d) => ({ comments: d.comments.filter((c) => c.id !== id) }));
    onCount(-1);
  };

  return (
    <section className="card comments" id="comments">
      <h2>Comments</h2>
      {user ? (
        <form className="comment-form" onSubmit={submit}>
          <Avatar user={user} size={36} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add to the conversation"
            maxLength={1000}
            rows={2}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit(e)}
          />
          <button className="btn btn--primary btn--sm" disabled={sending || !body.trim()}>Reply</button>
        </form>
      ) : (
        <p className="muted"><Link to="/login">Sign in</Link> to join the conversation.</p>
      )}
      <ErrorBox error={sendError || error} />
      {loading && <Spinner />}
      {data?.comments.length === 0 && <p className="muted">No comments yet.</p>}
      <ul className="comment-list">
        {data?.comments.map((c) => (
          <li key={c.id} className="comment">
            <Link to={`/u/${c.author.username}`} tabIndex={-1}><Avatar user={c.author} size={34} /></Link>
            <div className="comment__body">
              <div>
                <UserLink user={c.author} /> <span className="muted small">· {timeAgo(c.createdAt)}</span>
              </div>
              <p>{c.body}</p>
            </div>
            {user && (user.id === c.author.id || user.id === post.author.id) && (
              <button type="button" className="icon-btn" onClick={() => remove(c.id)} aria-label="Delete comment">
                <Icon name="trash" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, setData } = useFetch(`/posts/${id}`);
  const post = data?.post;
  const patch = (p) => setData((d) => ({ post: { ...d.post, ...p } }));

  useEffect(() => {
    if (post) document.title = `${post.title} · Botfrag`;
    return () => { document.title = 'Botfrag'; };
  }, [post]);

  if (loading) return <Spinner />;
  if (error) return <Empty icon="x" title={error.status === 404 ? 'This post does not exist' : 'Could not load post'}><p className="muted">{error.message}</p></Empty>;

  const isOwner = user?.id === post.author.id;
  const remove = async () => {
    if (!window.confirm('Delete this post for good?')) return;
    await api(`/posts/${post.id}`, { method: 'DELETE' });
    navigate(`/u/${user.username}`);
  };

  return (
    <>
      <article className={`card post-full post-card--${post.type}`}>
        <PostByline post={post} />
        <h1 className="post-full__title">{post.title}</h1>

        {post.type === 'review' && (
          <div className={`verdict verdict--${scoreTone(post.rating)}`}>
            <Score rating={post.rating} size="lg" />
            <div>
              <strong>{VERDICT[scoreTone(post.rating)]}</strong>
              <span className="muted">
                {post.author.displayName}&apos;s score for{' '}
                <Link to={`/games/${post.game.slug}`}>{post.game.name}</Link>
              </span>
            </div>
          </div>
        )}

        <Media items={post.media} />
        {post.body && <div className="post-full__body">{post.body}</div>}

        <div className="post-card__meta">
          <Link to={`/games/${post.game.slug}`} className="chip chip--game"><Icon name="gamepad" size={14} />{post.game.name}</Link>
          <SteamPlaytime steam={post.steam} />
          {post.tags.map((t) => <Link key={t} to={`/tags/${t}`} className="chip">#{t}</Link>)}
        </div>
        <p className="muted small">
          Posted {fullDate(post.createdAt)}
          {post.updatedAt !== post.createdAt && ' · edited'}
        </p>

        <footer className="actions">
          <LikeButton post={post} onChange={patch} />
          <a href="#comments" className="action"><Icon name="comment" size={18} />{post.commentCount}</a>
          <ShareButton post={post} />
          {isOwner && (
            <span className="actions__owner">
              <Link to={`/p/${post.id}/edit`} className="action"><Icon name="edit" size={18} />Edit</Link>
              <button type="button" className="action action--danger" onClick={remove}><Icon name="trash" size={18} />Delete</button>
            </span>
          )}
        </footer>
      </article>

      <Comments post={post} onCount={(n) => patch({ commentCount: post.commentCount + n })} />
    </>
  );
}
