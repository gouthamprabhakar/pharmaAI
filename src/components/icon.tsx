import type { CSSProperties } from "react";
const paths = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  return: "m9 3-6 6 6 6M3 9h11a6 6 0 0 1 0 12h-4",
  document: "M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8",
  chart: "M3 3v18h19M7 16v-5M12 16V7M17 16V4",
  sparkle: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  external: "M14 3h7v7m0-7L10 14M10 4H3v17h17v-7",
  check: "m5 12 4 4L19 6",
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 16,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
