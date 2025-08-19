import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";

type LogoProps = {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "full" | "icon";
  animated?: boolean;           // hover animation
  className?: string;           // set text color here (controls wordmark)
  hideLink?: boolean;           // render raw SVG without <Link>
  forceTheme?: "auto" | "light" | "dark"; // gradient theme only
};

export function Logo({
  size = "lg",
  variant = "full",
  animated = true,
  className = "",
  hideLink = false,
  forceTheme = "auto",
}: LogoProps) {
  const titleId = useId();
  const descId = useId();

  // Only trust `.dark` class to avoid accidental low-contrast text
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (forceTheme === "light") return setIsDark(false);
    if (forceTheme === "dark") return setIsDark(true);
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [forceTheme]);

  const S = {
    sm: { w: 180, h: 48, icon: 44, markBox: 80 },
    md: { w: 220, h: 56, icon: 56, markBox: 80 },
    lg: { w: 280, h: 72, icon: 72, markBox: 80 },
    xl: { w: 340, h: 88, icon: 88, markBox: 80 },
  }[size];

  const isIcon = variant === "icon";
  const width = isIcon ? S.icon : S.w;
  const height = isIcon ? S.icon : S.h;
  const vb = isIcon ? `0 0 ${S.markBox} ${S.markBox}` : `0 0 ${S.markBox + 240} ${S.markBox}`;

  const primaryGrad = isDark ? "url(#gp-dark)" : "url(#gp-light)";
  const accentGrad  = isDark ? "url(#ga-dark)" : "url(#ga-light)";

  const Mark = (
    <g transform="translate(0,0)" className={animated ? "logo-anim" : ""}>
      {/* outer glow circle */}
      <circle
        cx="40" cy="40" r="34"
        fill="none" stroke={primaryGrad} strokeWidth="2.5" opacity="0.95"
        filter="url(#glow)"
      />
      {/* dashed orbit */}
      <circle
        cx="40" cy="40" r="29"
        fill="none" stroke={primaryGrad} strokeWidth="1.5" strokeDasharray="2 9"
        opacity="0.6"
        className={animated ? "orbit" : ""}
      />
      {/* orbiting dot */}
      {animated && (
        <g>
          <path id="orb" d="M40,40 m-29,0 a29,29 0 1,0 58,0 a29,29 0 1,0 -58,0" fill="none"/>
          <circle r="2.3" fill={isDark ? "#9CC2FF" : "#4F86FF"}>
            <animateMotion dur="9s" repeatCount="indefinite">
              <mpath href="#orb" />
            </animateMotion>
          </circle>
        </g>
      )}
      {/* core rounded hex */}
      <path
        d="M40 12c1.8 0 3.6.47 5.1 1.36l11.2 6.46A10 10 0 0 1 62 29.49v21.02a10 10 0 0 1-5.7 9.17l-11.2 6.46c-1.5.89-3.3.4-5.1.4s-3.6.49-5.1-.4l-11.2-6.46A10 10 0 0 1 18 50.51V29.49a10 10 0 0 1 5.7-9.17l11.2-6.46C36.4 12.47 38.2 12 40 12Z"
        fill={primaryGrad}
        opacity="0.98"
      />
      {/* analytics bars (CSS scaleY for smoothness) */}
      <g transform="translate(24,24)">
        <rect x="0"  y="0" width="32" height="32" rx="8" fill={isDark ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.18)"} />
        <rect x="5"  y="8" width="5" height="18" rx="2" fill={accentGrad} className={animated ? "bar bar-a" : ""}/>
        <rect x="14" y="5" width="5" height="21" rx="2" fill={accentGrad} className={animated ? "bar bar-b" : ""}/>
        <rect x="23" y="3" width="5" height="23" rx="2" fill={accentGrad} className={animated ? "bar bar-c" : ""}/>
      </g>
      {/* twin arcs hinting the “3” */}
      <g opacity="0.95">
        <path d="M28 28c0-5 4.4-9 9.8-9 3.1 0 5.7 1.2 7.2 2.8" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M28 48c0-5 4.4-9 9.8-9 3.1 0 5.7 1.2 7.2 2.8" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
      </g>
    </g>
  );

  const Wordmark = !isIcon && (
    <g transform={`translate(${S.markBox + 20},0)`}>
      {/* Uses currentColor so you control contrast via className */}
      <text
        x="0" y="48"
        fill="currentColor"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial"
        fontSize="28" fontWeight="900" letterSpacing="0.2"
      >
        3CX <tspan fontWeight="500">Analytics</tspan>
      </text>
    </g>
  );

  const Svg = (
    <svg
      width={width}
      height={height}
      viewBox={vb}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={className}
    >
      <title id={titleId}>3CX Analytics</title>
      <desc id={descId}>Bigger mark with subtle orbit and a crisp wordmark.</desc>
      <defs>
        {/* Light */}
        <linearGradient id="gp-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor="#2563EB"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
        <linearGradient id="ga-light" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#22C55E"/>
          <stop offset="100%" stopColor="#14B8A6"/>
        </linearGradient>
        {/* Dark */}
        <linearGradient id="gp-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"  stopColor="#60A5FA"/>
          <stop offset="100%" stopColor="#A78BFA"/>
        </linearGradient>
        <linearGradient id="ga-dark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"  stopColor="#34D399"/>
          <stop offset="100%" stopColor="#22D3EE"/>
        </linearGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {Mark}
      {Wordmark}

      {/* Inline CSS so the component is self-contained */}
      <style>{`
        /* kill underline / borders on click/focus */
        .no-focus { outline: none !important; box-shadow: none !important; }

        /* animations */
        @keyframes spin-slow { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes floaty     { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-0.8px);} }
        @keyframes pulseA     { 0%,100% { transform: scaleY(1);} 50% { transform: scaleY(1.25);} }
        @keyframes pulseB     { 0%,100% { transform: scaleY(1);} 50% { transform: scaleY(1.35);} }
        @keyframes pulseC     { 0%,100% { transform: scaleY(1);} 50% { transform: scaleY(1.45);} }

        .logo-anim { transform-origin: 40px 40px; }
        .logo-anim:hover { animation: floaty 3s ease-in-out infinite; }

        .orbit { animation: spin-slow 12s linear infinite; transform-origin: 40px 40px; }

        .bar { transform-origin: center bottom; }
        .bar-a { animation: pulseA 2.8s ease-in-out infinite; }
        .bar-b { animation: pulseB 2.8s ease-in-out .15s infinite; }
        .bar-c { animation: pulseC 2.8s ease-in-out .3s  infinite; }

        @media (prefers-reduced-motion: reduce) {
          .logo-anim, .orbit, .bar-a, .bar-b, .bar-c { animation: none !important; }
        }
      `}</style>
    </svg>
  );

  const Wrapper: React.FC<{children: React.ReactNode}> = ({ children }) =>
    hideLink ? (
      <>{children}</>
    ) : (
      <Link
        to="/"
        aria-label="Go to Dashboard"
        className="inline-block no-focus"
        style={{
          outline: "none",
          boxShadow: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {children}
      </Link>
    );

  return <Wrapper>{Svg}</Wrapper>;
}
