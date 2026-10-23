const src = `${import.meta.env.BASE_URL}icons/logo.svg`;

export function Logo({ size = 40 }: { size?: number }) {
  return <img src={src} width={size} height={size} alt="" aria-hidden className="hp-logo" />;
}
