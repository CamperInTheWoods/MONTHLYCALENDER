import './StarRating.css';

interface Props {
  value: number; // 0~5, 0.5 단위
  onChange: (value: number) => void;
  size?: number;
}

const STARS = [1, 2, 3, 4, 5];
const STAR_POINTS =
  '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';

export function StarRating({ value, onChange, size = 30 }: Props) {
  // 같은 값을 다시 누르면 해제(0)
  const pick = (target: number) => onChange(value === target ? 0 : target);

  return (
    <div className="stars">
      {STARS.map((n) => {
        const fill = value >= n ? 'full' : value >= n - 0.5 ? 'half' : 'empty';
        return (
          <span
            key={n}
            className="stars__item"
            style={{ width: size, height: size }}
          >
            <span className="stars__bg">
              <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <polygon points={STAR_POINTS} />
              </svg>
            </span>
            {fill !== 'empty' && (
              <span
                className={`stars__fg ${fill === 'half' ? 'is-half' : ''}`}
              >
                <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points={STAR_POINTS} />
                </svg>
              </span>
            )}
            <button
              type="button"
              className="stars__half stars__half--l"
              onClick={() => pick(n - 0.5)}
              aria-label={`${n - 0.5}점`}
            />
            <button
              type="button"
              className="stars__half stars__half--r"
              onClick={() => pick(n)}
              aria-label={`${n}점`}
            />
          </span>
        );
      })}
    </div>
  );
}
