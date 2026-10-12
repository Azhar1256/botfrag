import { useEffect, useState } from 'react';
import { api, qs } from '../lib/api.js';
import PostCard from './PostCard.jsx';
import { Empty, ErrorBox, Spinner } from './ui.jsx';

// Paginated list of posts for any combination of feed filters.
export default function Feed({ params, empty }) {
  const key = qs(params);
  const [state, setState] = useState({ key: null, posts: [], page: 0, pages: 0, loading: true, error: null });

  const load = async (page, reset) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(`/posts${qs({ ...params, page })}`);
      setState((s) => ({
        key,
        posts: reset ? data.posts : [...s.posts, ...data.posts],
        page: data.page,
        pages: data.pages,
        loading: false,
        error: null,
      }));
    } catch (error) {
      setState((s) => ({ ...s, key, loading: false, error }));
    }
  };

  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fresh = state.key === key;

  return (
    <div className="feed">
      <ErrorBox error={state.error} />
      {fresh && state.posts.map((p) => <PostCard key={p.id} post={p} />)}
      {state.loading && <Spinner />}
      {fresh && !state.loading && !state.error && state.posts.length === 0 && (empty ?? <Empty title="Nothing here yet" />)}
      {fresh && !state.loading && state.page < state.pages && (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => load(state.page + 1, false)}>
          Load more
        </button>
      )}
    </div>
  );
}
