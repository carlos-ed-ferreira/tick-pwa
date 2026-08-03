/**
 * Borda tracejada desenhada como stroke de SVG.
 *
 * `border-dashed` perde cor e ritmo nas quinas arredondadas, porque cada traço
 * é rasterizado na diagonal do grid de pixels. O stroke do SVG acompanha a
 * curva do retângulo e mantém cor e espaçamento iguais em toda a extensão.
 *
 * A cor sai de `--dashed-ring-color`, então o elemento pai controla hover e
 * demais estados pelas próprias classes utilitárias. `radius` acompanha o
 * arredondamento do pai, em pixels.
 */
export function DashedRing({
  className = '',
  radius,
}: {
  className?: string;
  radius: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-visible ${className}`}
      style={{
        inset: 'calc(var(--hairline) / 2)',
        width: 'calc(100% - var(--hairline))',
        height: 'calc(100% - var(--hairline))',
      }}
    >
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        rx={radius}
        fill="none"
        style={{
          stroke: 'var(--dashed-ring-color, currentColor)',
          strokeDasharray: '7 6',
          strokeWidth: 'var(--hairline)',
        }}
      />
    </svg>
  );
}
