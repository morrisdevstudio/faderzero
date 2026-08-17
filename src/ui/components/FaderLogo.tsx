import type { SVGProps } from 'react';

export function FaderLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96 40"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {/* Piste verticale du fader */}
      <rect x="4" y="0" width="2" height="40" rx="0.5" />
      {/* Curseur / capuchon du fader */}
      <rect x="0" y="10" width="10" height="12" rx="1.5" />

      {/* Typographie vectorielle avec espacement justifié plus serré */}
      <text
        x="16"
        y="17"
        textLength="76"
        lengthAdjust="spacing"
        fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="16"
      >
        FADER
      </text>
      <text
        x="16"
        y="35"
        textLength="76"
        lengthAdjust="spacing"
        fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="16"
      >
        ZERO
      </text>
    </svg>
  );
}
