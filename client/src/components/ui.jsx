import { Link } from 'react-router-dom';
import { hueOf, scoreTone } from '../lib/format.js';
import Icon from './Icon.jsx';

export function Avatar({ user, size = 40 }) {
  const name = user?.displayName || user?.username || '?';
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user?.avatarUrl) return <img className="avatar" src={user.avatarUrl} alt="" style={style} />;
  return (
    <span className="avatar avatar--initial" style={{ ...style, background: `hsl(${hueOf(user?.username)} 55% 32%)` }} aria-hidden="true">
      {name[0].toUpperCase()}
    </span>
  );
}

export function UserLink({ user, children }) {
  return <Link to={`/u/${user.username}`} className="user-link">{children ?? user.displayName}</Link>;
}

export function Score({ rating, size = 'md' }) {
  return (
    <span className={`score score--${scoreTone(rating)} score--${size}`} title={`${rating} out of 10`}>
      {Number.isInteger(rating) ? rating : rating.toFixed(1)}
      <small>/10</small>
    </span>
  );
}

export function TypeBadge({ type }) {
  return (
    <span className={`badge badge--${type}`}>
      <Icon name={type === 'review' ? 'star' : 'clip'} size={13} />
      {type === 'review' ? 'Review' : 'Moment'}
    </span>
  );
}

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;

export function Empty({ icon = 'gamepad', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export const ErrorBox = ({ error }) => (error ? <div className="error-box" role="alert">{error.message || String(error)}</div> : null);

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} className={value === key ? 'is-active' : ''} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}
