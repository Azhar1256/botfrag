import { useState } from 'react';

function MediaItem({ item, autoPlay }) {
  if (item.kind === 'youtube') {
    return (
      <div className="media__frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${item.url}`}
          title="YouTube clip"
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (item.kind === 'video') {
    return <video className="media__el" src={item.url} controls playsInline preload="metadata" autoPlay={autoPlay} muted={autoPlay} />;
  }
  return <img className="media__el" src={item.url} alt="" loading="lazy" />;
}

// Shows a post's media one at a time, with dots to switch when there are several.
export default function Media({ items, autoPlay = false }) {
  const [i, setI] = useState(0);
  if (!items?.length) return null;
  const current = items[Math.min(i, items.length - 1)];

  return (
    <div className="media">
      <MediaItem key={`${current.kind}:${current.url}`} item={current} autoPlay={autoPlay} />
      {items.length > 1 && (
        <div className="media__dots">
          {items.map((m, n) => (
            <button
              key={m.url}
              type="button"
              className={n === i ? 'is-active' : ''}
              aria-label={`Show item ${n + 1} of ${items.length}`}
              onClick={(e) => {
                e.preventDefault();
                setI(n);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
