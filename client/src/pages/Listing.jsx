import { Link, useParams, useSearchParams } from 'react-router-dom';
import Feed from '../components/Feed.jsx';
import Icon from '../components/Icon.jsx';
import { Empty } from '../components/ui.jsx';
import { SortBar, useSort } from './Home.jsx';

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const sort = useSort();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p className="muted">{q ? <>Results for “{q}”</> : 'Type in the search bar to find posts, games and tags.'}</p>
        </div>
        {q && <SortBar />}
      </div>
      {q && <Feed params={{ ...sort, q }} empty={<Empty icon="search" title="No matches"><p className="muted">Try a game name or a tag.</p></Empty>} />}
    </>
  );
}

export function TagPage() {
  const { tag } = useParams();
  const sort = useSort();
  return (
    <>
      <div className="page-head">
        <div>
          <h1><Icon name="hash" size={26} />{tag}</h1>
          <p className="muted">Posts tagged #{tag}</p>
        </div>
        <SortBar />
      </div>
      <Feed params={{ ...sort, tag }} />
    </>
  );
}

export function NotFound() {
  return (
    <Empty icon="x" title="Page not found">
      <Link to="/" className="btn btn--primary">Back to the feed</Link>
    </Empty>
  );
}
