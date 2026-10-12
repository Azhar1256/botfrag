import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GamePicker from '../components/GamePicker.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorBox, Score, Spinner } from '../components/ui.jsx';
import { api, uploadFile } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import useFetch from '../lib/useFetch.js';

const PLATFORMS = ['PC', 'PlayStation', 'Xbox', 'Switch', 'Mobile', 'Other'];
const MAX_MEDIA = 6;
const YT = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/;

function MediaPicker({ media, setMedia }) {
  const [uploads, setUploads] = useState([]); // in-flight: { name, progress }
  const [link, setLink] = useState('');
  const [error, setError] = useState(null);
  const full = media.length + uploads.length >= MAX_MEDIA;

  const addFiles = async (files) => {
    setError(null);
    const list = [...files].slice(0, MAX_MEDIA - media.length - uploads.length);
    await Promise.all(
      list.map(async (file) => {
        const name = `${file.name}-${file.size}-${Math.random()}`;
        setUploads((u) => [...u, { name, label: file.name, progress: 0 }]);
        try {
          const item = await uploadFile(file, (p) => setUploads((u) => u.map((x) => (x.name === name ? { ...x, progress: p } : x))));
          setMedia((m) => [...m, item]);
        } catch (err) {
          setError(err);
        } finally {
          setUploads((u) => u.filter((x) => x.name !== name));
        }
      })
    );
  };

  const addLink = () => {
    const id = link.match(YT)?.[1];
    if (!id) return setError(new Error('Paste a YouTube video or Shorts link'));
    setMedia((m) => [...m, { kind: 'youtube', url: id }]);
    setLink('');
    setError(null);
    return undefined;
  };

  return (
    <div className="field">
      <span className="label">Media <span className="muted">(optional, up to {MAX_MEDIA})</span></span>
      <div className="media-grid">
        {media.map((m, i) => (
          <div key={m.url} className="media-thumb">
            {m.kind === 'image' && <img src={m.url} alt="" />}
            {m.kind === 'video' && <video src={m.url} muted preload="metadata" />}
            {m.kind === 'youtube' && <img src={`https://i.ytimg.com/vi/${m.url}/hqdefault.jpg`} alt="" />}
            <span className="media-thumb__kind">{m.kind === 'youtube' ? 'YouTube' : m.kind}</span>
            <button type="button" className="media-thumb__remove" aria-label="Remove" onClick={() => setMedia((all) => all.filter((_, j) => j !== i))}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
        {uploads.map((u) => (
          <div key={u.name} className="media-thumb media-thumb--loading">
            <span className="small">{Math.round(u.progress * 100)}%</span>
            <div className="progress"><span style={{ width: `${u.progress * 100}%` }} /></div>
          </div>
        ))}
        {!full && (
          <label className="media-drop">
            <Icon name="upload" size={22} />
            <span>Add images or clips</span>
            <small className="muted">JPG, PNG, GIF, WebP · MP4, WebM, MOV up to 100 MB</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
              multiple
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {!full && (
        <div className="inline-input">
          <Icon name="youtube" size={18} />
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a YouTube link" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={addLink} disabled={!link.trim()}>Add</button>
        </div>
      )}
      <ErrorBox error={error} />
    </div>
  );
}

export default function Compose() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const existing = useFetch(id ? `/posts/${id}` : null);

  const [form, setForm] = useState({
    type: search.get('type') === 'review' ? 'review' : 'moment',
    title: '',
    game: { name: search.get('game') ?? '', igdbId: null },
    platform: user?.platforms?.[0] ?? '',
    rating: 8,
    body: '',
    tags: '',
  });
  const [media, setMedia] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The signed-in user may load after first render; default the platform once they do.
  const defaultPlatform = user?.platforms?.[0];
  useEffect(() => {
    if (!id && defaultPlatform) setForm((f) => (f.platform ? f : { ...f, platform: defaultPlatform }));
  }, [id, defaultPlatform]);

  useEffect(() => {
    const p = existing.data?.post;
    if (!p) return;
    setForm({ type: p.type, title: p.title, game: { name: p.game.name, igdbId: null }, platform: p.platform, rating: p.rating ?? 8, body: p.body, tags: p.tags.join(', ') });
    setMedia(p.media);
  }, [existing.data]);

  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: id ? `/p/${id}/edit` : '/new' }} />;
  if (id && existing.loading) return <Spinner />;
  if (id && existing.data && existing.data.post.author.id !== user.id) return <Navigate to={`/p/${id}`} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isReview = form.type === 'review';

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = { ...form, rating: isReview ? Number(form.rating) : undefined, media };
      const { post } = id
        ? await api(`/posts/${id}`, { method: 'PATCH', body })
        : await api('/posts', { method: 'POST', body });
      navigate(`/p/${post.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  };

  return (
    <form className="card compose" onSubmit={submit}>
      <h1>{id ? 'Edit post' : 'Create a post'}</h1>

      <div className="type-picker" role="radiogroup" aria-label="Post type">
        {[
          ['moment', 'clip', 'Moment', 'A clip, screenshot or story from a session'],
          ['review', 'star', 'Review', 'Your verdict on a game, with a score out of 10'],
        ].map(([value, icon, label, hint]) => (
          <label key={value} className={`type-option ${form.type === value ? 'is-active' : ''}`}>
            <input type="radio" name="type" value={value} checked={form.type === value} onChange={set('type')} />
            <Icon name={icon} size={22} />
            <strong>{label}</strong>
            <small>{hint}</small>
          </label>
        ))}
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="game-input">Game</label>
          <GamePicker id="game-input" value={form.game} onChange={(game) => setForm((f) => ({ ...f, game }))} />
        </div>
        <label className="field">
          <span className="label">Platform</span>
          <select className="select" value={form.platform} onChange={set('platform')}>
            <option value="">Not specified</option>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="label">Title</span>
        <input
          className="input"
          value={form.title}
          onChange={set('title')}
          required
          maxLength={120}
          placeholder={isReview ? 'Sum up your verdict in a line' : 'What happened?'}
        />
      </label>

      {isReview && (
        <div className="field">
          <span className="label">Score</span>
          <div className="rating-input">
            <input type="range" min="1" max="10" step="1" value={form.rating} onChange={set('rating')} aria-label="Score out of 10" />
            <Score rating={Number(form.rating)} size="lg" />
          </div>
        </div>
      )}

      <label className="field">
        <span className="label">{isReview ? 'Your review' : 'Description'} <span className="muted">(optional)</span></span>
        <textarea
          className="input"
          value={form.body}
          onChange={set('body')}
          rows={isReview ? 8 : 4}
          maxLength={5000}
          placeholder={isReview ? 'What worked, what did not, and who should play it?' : 'Set the scene'}
        />
      </label>

      <MediaPicker media={media} setMedia={setMedia} />

      <label className="field">
        <span className="label">Tags <span className="muted">(comma separated)</span></span>
        <input className="input" value={form.tags} onChange={set('tags')} placeholder="clutch, ranked, funny" />
      </label>

      <ErrorBox error={error} />
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
        <button className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Publish'}</button>
      </div>
    </form>
  );
}
