interface TransjuIconProps {
  color: string;
  size?: number;
  className?: string;
}

/**
 * Emblème officiel de La Transju' (l'épicéa du Jura, page 9 de la charte)
 * colorisé dynamiquement selon la discipline consultée.
 */
export function TransjuIcon({ color, size = 28, className }: TransjuIconProps) {
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
    </svg>
  );
}
