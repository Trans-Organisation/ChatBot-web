import type { DisciplineKey } from '../theme/disciplines';

interface TransjuIconProps {
  discipline: DisciplineKey;
  color: string;
  size?: number;
  className?: string;
}

/**
 * Emblème officiel de La Transju' (l'épicéa du Jura, page 9 de la charte)
 * accompagné d'un marqueur discret spécifique à la discipline (Trails, Cyclo, Jeunes, Ski).
 */
export function TransjuIcon({ discipline, color, size = 28, className }: TransjuIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Silhouette de l'épicéa penché La Transju' */}
      <path
        d="M23.5 3.5L13 15.2L16.2 15.8L9.8 24.4L13.5 25L8.5 32.5C14.8 33.4 22.8 33.1 28.5 31.6L24.5 24.2L27.4 23.6L22.6 15.4L25.8 14.6L23.5 3.5Z"
        fill={color}
      />
      <path
        d="M17.2 33.2C17.2 35.1 15.8 36.1 13.8 36.3C15.9 36.8 18.8 36.6 20.1 35.5C21.1 34.7 21.1 33.6 20.8 33.1H17.2Z"
        fill={color}
      />

      {/* Badge discipline en bas à droite */}
      {discipline === 'trail' && (
        <path
          d="M27 36L31 29L34 33L36 30.5L39 36H27Z"
          fill="#FFFFFF"
          stroke="#110856"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
      {discipline === 'cyclo' && (
        <g stroke="#FFFFFF" strokeWidth="1.8">
          <circle cx="32" cy="33" r="4.2" fill="#110856" />
          <circle cx="32" cy="33" r="1.2" fill={color} stroke="none" />
        </g>
      )}
      {discipline === 'jeunes' && (
        <path
          d="M33 27.5L34.3 30.6L37.6 30.9L35.1 33.1L35.9 36.4L33 34.6L30.1 36.4L30.9 33.1L28.4 30.9L31.7 30.6L33 27.5Z"
          fill="#FFFFFF"
          stroke="#110856"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />
      )}
      {discipline === 'nordique' && (
        <g stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round">
          <line x1="33" y1="27.5" x2="33" y2="36.5" />
          <line x1="29.1" y1="29.8" x2="36.9" y2="34.2" />
          <line x1="36.9" y1="29.8" x2="29.1" y2="34.2" />
        </g>
      )}
    </svg>
  );
}
