'use client';

import { useEffect, useState } from 'react';
import styles from '../apps.module.css';
import PlayerAuth from '@/components/PlayerAuth';
import { getPlayerSession, logoutPlayer, onPlayerChange, playerFetch, type PlayerProfile, errorMessage } from '@/lib/player';

interface Review {
  $id: string;
  playerId: string;
  gameName: string;
  rating: number;
  comment: string | null;
  updatedAt: string;
}

interface ReviewData {
  count: number;
  average: number | null;
  reviews: Review[];
}

function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} style={{ fontSize: size + 'px' }} role="img" aria-label={value.toFixed(1) + ' out of 5 stars'}>
      <span className={styles.starsFill} style={{ width: (value / 5) * 100 + '%' }}>★★★★★</span>
      ★★★★★
    </span>
  );
}

function when(sqlTime: string): string {
  const d = new Date(sqlTime.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

// Ratings and comments for one app. Anyone can read; posting needs a
// player account (in-game name + phone + PIN), one review per app.
export default function Reviews({ appId, appTitle }: { appId: string; appTitle: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    const sync = () => setPlayer(getPlayerSession()?.player || null);
    sync();
    return onPlayerChange(sync);
  }, []);

  useEffect(() => {
    playerFetch<ReviewData>('/app-reviews?appId=' + encodeURIComponent(appId))
      .then(setData)
      .catch(() => setLoadError('Reviews could not be loaded right now.'));
  }, [appId]);

  const mine = player && data ? data.reviews.find((r) => r.playerId === player.id) : undefined;

  // Prefill the form with the player's existing review so posting edits it.
  useEffect(() => {
    if (mine) { setRating(mine.rating); setComment(mine.comment || ''); }
  }, [mine?.$id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved('');
    if (!rating) return setError('Tap a star to rate this app.');
    setBusy(true);
    try {
      const res = await playerFetch<{ review: Review; count: number; average: number | null }>('/app-reviews', {
        method: 'PUT', body: { appId, rating, comment },
      });
      setData((d) => ({
        count: res.count,
        average: res.average,
        reviews: [res.review, ...(d?.reviews || []).filter((r) => r.$id !== res.review.$id)],
      }));
      setSaved(mine ? 'Your review was updated.' : 'Thanks! Your review is posted.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete your review?')) return;
    try {
      await playerFetch('/app-reviews/' + id, { method: 'DELETE' });
      const refreshed = await playerFetch<ReviewData>('/app-reviews?appId=' + encodeURIComponent(appId));
      setData(refreshed);
      setRating(0); setComment(''); setSaved('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className={styles.panel} id="reviews">
      <div className={styles.reviewHead}>
        <h2 className={styles.sectionTitle}>Ratings &amp; reviews</h2>
        {data && data.count > 0 && data.average !== null && (
          <div className={styles.reviewScore}>
            <strong>{data.average.toFixed(1)}</strong>
            <Stars value={data.average} />
            <span>{data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
          </div>
        )}
      </div>

      {player ? (
        <form onSubmit={submit} className={styles.reviewForm}>
          <p className={styles.reviewAs}>
            {mine ? 'Your review' : 'Rate ' + appTitle} as <strong>{player.gameName}</strong>
            <button type="button" onClick={logoutPlayer} className={styles.linkBtn}>Log out</button>
          </p>
          <div className={styles.starPick} role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={n + (n === 1 ? ' star' : ' stars')}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                className={(hover || rating) >= n ? styles.starOn : styles.starOff}
              >★</button>
            ))}
          </div>
          <label htmlFor="review-comment" className={styles.label}>Comment (optional)</label>
          <textarea
            id="review-comment"
            className={styles.textarea}
            style={{ minHeight: '90px' }}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What do you like? What could be better?"
          />
          {error && <div className={`${styles.alert} ${styles.alertErr}`} style={{ margin: 0 }}>{error}</div>}
          {saved && <div className={`${styles.alert} ${styles.alertOk}`} style={{ margin: 0 }}>{saved}</div>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" className={styles.cta} disabled={busy}>{busy ? 'Saving…' : mine ? 'Update review' : 'Post review'}</button>
            {mine && <button type="button" className={styles.ctaGhost} onClick={() => remove(mine.$id)}>Delete my review</button>}
          </div>
        </form>
      ) : (
        <div className={styles.reviewLogin}>
          <PlayerAuth intro={'Log in or create a free player account to rate ' + appTitle + '. The same account works for the Simon Speed competition.'} />
        </div>
      )}

      {loadError && <p className={styles.sideText}>{loadError}</p>}
      {data && data.reviews.length === 0 && <p className={styles.sideText} style={{ marginTop: '18px' }}>No reviews yet. Be the first to rate this app.</p>}
      {data && data.reviews.length > 0 && (
        <ul className={styles.reviewList}>
          {data.reviews.map((r) => (
            <li key={r.$id} className={styles.review}>
              <div className={styles.reviewMeta}>
                <span className={styles.reviewAvatar} aria-hidden="true">{r.gameName.slice(0, 1).toUpperCase()}</span>
                <strong>{r.gameName}</strong>
                <Stars value={r.rating} size={14} />
                <span className={styles.reviewDate}>{when(r.updatedAt)}</span>
              </div>
              {r.comment && <p className={styles.reviewText}>{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
