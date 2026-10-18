export default function BrandMark({ size = 22 }) {
  return (
    <svg
      className="lane-local-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Lane & Local route-and-leaf mark"
    >
      <path
        d="M6.3 26.2c1.6-6.7 5.1-12 10.5-16.1"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M15.7 27c.7-4.4 3.1-8.1 7.5-11.3"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M17.1 5.2c5.8-.1 9.3 3.2 8.9 7.3-.4 4.4-4 7.2-7.6 7.1-2.3-.1-4-1.6-3.7-4.1.3-3.7 1.1-7.1 2.4-10.3Z"
        fill="currentColor"
        fillOpacity=".13"
        stroke="currentColor"
        strokeWidth="2.05"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 24.4c1.9-1.8 3.5-3.7 4.8-5.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="2.1 3.2"
      />
    </svg>
  );
}
