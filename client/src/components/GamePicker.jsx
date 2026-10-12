import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { gameGradient } from '../lib/format.js';

// Game name input with autocomplete from Botfrag's games and IGDB.
// `value` is { name, igdbId }; typing clears igdbId until a suggestion is picked.
export default function GamePicker({ id, value, onChange }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const typed = useRef(false); // only search after the user types, not for prefilled names
  const listId = useId();

  useEffect(() => {
    const q = value.name.trim();
    if (!typed.current || q.length < 2) {
      setResults([]);
      return undefined;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      api(`/games/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((d) => {
          setResults(d.results);
          setActive(-1);
          setLoading(false);
        })
        .catch((e) => e.name !== 'AbortError' && setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value.name]);

  const pick = (g) => {
    onChange({ name: g.name, igdbId: g.igdbId });
    setOpen(false);
    typed.current = false;
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + d + results.length) % results.length);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="picker">
      <input
        id={id}
        className="input"
        value={value.name}
        onChange={(e) => {
          typed.current = true;
          setOpen(true);
          onChange({ name: e.target.value, igdbId: null });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        required
        maxLength={80}
        placeholder="Search for a game"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />
      {value.igdbId && <span className="picker__ok" title="Linked to IGDB">✓</span>}
      {open && (results.length > 0 || loading) && (
        <ul className="picker__list" id={listId} role="listbox">
          {loading && !results.length && <li className="picker__hint muted small">Searching…</li>}
          {results.map((g, i) => (
            <li
              key={`${g.slug}-${g.igdbId}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : ''}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(g);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="picker__cover" style={{ background: g.coverUrl ? `center/cover url(${g.coverUrl})` : gameGradient(g.slug) }} />
              <span className="picker__name">
                {g.name}
                <small className="muted">
                  {[g.year, g.posts ? `${g.posts} post${g.posts === 1 ? '' : 's'} on Botfrag` : null].filter(Boolean).join(' · ')}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
