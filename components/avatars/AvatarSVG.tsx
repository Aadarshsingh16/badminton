// components/avatars/AvatarSVG.tsx — Unique SVG avatar for each player

import React from "react";
import { AvatarType } from "@/lib/types";

interface AvatarSVGProps {
  type: AvatarType;
  size?: number;
  emoji?: string;
  color?: string;
  className?: string;
}

// Clumsy — Adarsh: tripping with bandaid, shuttlecock nearby
const ClumsyAvatar = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background circle */}
    <circle cx="50" cy="50" r="48" fill="#FF6B35" fillOpacity="0.15" />
    {/* Body */}
    <ellipse cx="50" cy="68" rx="18" ry="22" fill="#FF6B35" />
    {/* Head */}
    <circle cx="50" cy="35" r="18" fill="#FDDCB5" />
    {/* Hair */}
    <ellipse cx="50" cy="20" rx="16" ry="8" fill="#4A2C0A" />
    {/* Bandaid on forehead */}
    <rect x="43" y="24" width="14" height="6" rx="2" fill="#F4A261" />
    <rect x="49" y="23" width="2" height="8" rx="1" fill="#E76F51" />
    <rect x="43" y="26" width="14" height="2" rx="1" fill="#E76F51" />
    {/* Eyes (dizzy) */}
    <line x1="43" y1="35" x2="47" y2="39" stroke="#333" strokeWidth="2" strokeLinecap="round" />
    <line x1="47" y1="35" x2="43" y2="39" stroke="#333" strokeWidth="2" strokeLinecap="round" />
    <line x1="53" y1="35" x2="57" y2="39" stroke="#333" strokeWidth="2" strokeLinecap="round" />
    <line x1="57" y1="35" x2="53" y2="39" stroke="#333" strokeWidth="2" strokeLinecap="round" />
    {/* Mouth (oops!) */}
    <path d="M44 44 Q50 48 56 44" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Arms flailing */}
    <line x1="32" y1="62" x2="18" y2="50" stroke="#FDDCB5" strokeWidth="6" strokeLinecap="round" />
    <line x1="68" y1="62" x2="82" y2="50" stroke="#FDDCB5" strokeWidth="6" strokeLinecap="round" />
    {/* Legs tripping */}
    <line x1="44" y1="88" x2="36" y2="96" stroke="#4A2C0A" strokeWidth="6" strokeLinecap="round" />
    <line x1="56" y1="88" x2="72" y2="92" stroke="#4A2C0A" strokeWidth="6" strokeLinecap="round" />
    {/* Shuttlecock */}
    <circle cx="20" cy="82" r="4" fill="white" stroke="#ccc" strokeWidth="1" />
    <line x1="20" y1="78" x2="16" y2="68" stroke="#E76F51" strokeWidth="2" />
    <line x1="20" y1="78" x2="20" y2="66" stroke="#E76F51" strokeWidth="2" />
    <line x1="20" y1="78" x2="24" y2="68" stroke="#E76F51" strokeWidth="2" />
  </svg>
);

// Dwarf — Akshat: short, stocky, big beard
const DwarfAvatar = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#A8DADC" fillOpacity="0.2" />
    {/* Stocky body */}
    <rect x="28" y="60" width="44" height="28" rx="10" fill="#457B9D" />
    {/* Belt */}
    <rect x="28" y="73" width="44" height="5" rx="2" fill="#1D3557" />
    <rect x="47" y="72" width="6" height="7" rx="1" fill="#F4A261" />
    {/* Head (bigger, stockier) */}
    <circle cx="50" cy="42" r="20" fill="#FDDCB5" />
    {/* Thick beard */}
    <ellipse cx="50" cy="56" rx="16" ry="10" fill="#5C3317" />
    <ellipse cx="50" cy="50" rx="13" ry="8" fill="#5C3317" />
    {/* Mustache */}
    <ellipse cx="45" cy="48" rx="6" ry="3" fill="#3D2009" />
    <ellipse cx="55" cy="48" rx="6" ry="3" fill="#3D2009" />
    {/* Eyes */}
    <circle cx="44" cy="40" r="3" fill="#333" />
    <circle cx="56" cy="40" r="3" fill="#333" />
    <circle cx="45" cy="39" r="1" fill="white" />
    <circle cx="57" cy="39" r="1" fill="white" />
    {/* Helmet/hat */}
    <rect x="30" y="24" width="40" height="18" rx="6" fill="#1D3557" />
    <rect x="26" y="30" width="48" height="6" rx="3" fill="#457B9D" />
    {/* Tiny racket */}
    <circle cx="80" cy="72" r="8" fill="none" stroke="#F4A261" strokeWidth="2" />
    <line x1="78" y1="70" x2="82" y2="74" stroke="#F4A261" strokeWidth="1.5" />
    <line x1="82" y1="70" x2="78" y2="74" stroke="#F4A261" strokeWidth="1.5" />
    <line x1="80" y1="80" x2="80" y2="92" stroke="#8B5E3C" strokeWidth="3" strokeLinecap="round" />
    {/* Arms */}
    <line x1="28" y1="68" x2="16" y2="72" stroke="#FDDCB5" strokeWidth="6" strokeLinecap="round" />
    <line x1="72" y1="68" x2="80" y2="72" stroke="#FDDCB5" strokeWidth="6" strokeLinecap="round" />
    {/* Legs (short) */}
    <rect x="34" y="86" width="10" height="10" rx="4" fill="#1D3557" />
    <rect x="56" y="86" width="10" height="10" rx="4" fill="#1D3557" />
  </svg>
);

// Nerd — Harsh: glasses, pocket protector, awkward racket hold
const NerdAvatar = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#E9C46A" fillOpacity="0.15" />
    {/* Body */}
    <rect x="30" y="62" width="40" height="26" rx="8" fill="#2A9D8F" />
    {/* Pocket protector */}
    <rect x="44" y="62" width="12" height="14" rx="2" fill="white" fillOpacity="0.3" />
    <rect x="46" y="64" width="2" height="10" rx="1" fill="#E9C46A" />
    <rect x="49" y="64" width="2" height="10" rx="1" fill="#E76F51" />
    <rect x="52" y="64" width="2" height="10" rx="1" fill="#264653" />
    {/* Head */}
    <circle cx="50" cy="40" r="18" fill="#FDDCB5" />
    {/* Hair */}
    <ellipse cx="50" cy="24" rx="15" ry="7" fill="#2D1B00" />
    <line x1="50" y1="24" x2="50" y2="28" stroke="#2D1B00" strokeWidth="3" />
    {/* Big glasses */}
    <circle cx="43" cy="40" r="7" fill="none" stroke="#264653" strokeWidth="2.5" />
    <circle cx="57" cy="40" r="7" fill="none" stroke="#264653" strokeWidth="2.5" />
    <line x1="50" y1="40" x2="50" y2="40" stroke="#264653" strokeWidth="2" />
    <line x1="36" y1="40" x2="32" y2="38" stroke="#264653" strokeWidth="2" strokeLinecap="round" />
    <line x1="64" y1="40" x2="68" y2="38" stroke="#264653" strokeWidth="2" strokeLinecap="round" />
    {/* Eyes behind glasses */}
    <circle cx="43" cy="40" r="3" fill="#264653" />
    <circle cx="57" cy="40" r="3" fill="#264653" />
    {/* Smile (slight, nervous) */}
    <path d="M44 49 Q50 53 56 49" stroke="#8B5E3C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {/* Arms (awkward hold) */}
    <line x1="30" y1="72" x2="14" y2="68" stroke="#FDDCB5" strokeWidth="6" strokeLinecap="round" />
    <line x1="70" y1="72" x2="86" y2="60" stroke="#FDDCB5" strokeWidth="6" strokeLinecap="round" />
    {/* Racket held awkwardly high */}
    <ellipse cx="90" cy="50" rx="7" ry="9" fill="none" stroke="#E9C46A" strokeWidth="2" transform="rotate(-30 90 50)" />
    <line x1="86" y1="56" x2="80" y2="64" stroke="#8B5E3C" strokeWidth="3" strokeLinecap="round" />
    {/* Legs */}
    <line x1="43" y1="86" x2="40" y2="97" stroke="#2A9D8F" strokeWidth="7" strokeLinecap="round" />
    <line x1="57" y1="86" x2="60" y2="97" stroke="#2A9D8F" strokeWidth="7" strokeLinecap="round" />
  </svg>
);

// Bigfoot — Udbhaw: tall, furry, oversized feet
const BigfootAvatar = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#8B5E3C" fillOpacity="0.15" />
    {/* Furry body */}
    <ellipse cx="50" cy="66" rx="20" ry="24" fill="#6B3F1F" />
    {/* Fur texture lines on body */}
    <path d="M33 58 Q37 52 33 46" stroke="#4A2C0A" strokeWidth="1.5" fill="none" />
    <path d="M37 62 Q41 54 37 48" stroke="#4A2C0A" strokeWidth="1.5" fill="none" />
    <path d="M63 58 Q59 52 63 46" stroke="#4A2C0A" strokeWidth="1.5" fill="none" />
    <path d="M67 62 Q63 54 67 48" stroke="#4A2C0A" strokeWidth="1.5" fill="none" />
    {/* Head (tall) */}
    <ellipse cx="50" cy="32" rx="17" ry="20" fill="#8B5E3C" />
    {/* Fur on head */}
    <path d="M34 28 Q30 18 38 14" stroke="#6B3F1F" strokeWidth="2" fill="none" />
    <path d="M66 28 Q70 18 62 14" stroke="#6B3F1F" strokeWidth="2" fill="none" />
    <ellipse cx="50" cy="15" rx="12" ry="6" fill="#6B3F1F" />
    {/* Eyes (friendly, wide) */}
    <circle cx="43" cy="30" r="5" fill="#FDDCB5" />
    <circle cx="57" cy="30" r="5" fill="#FDDCB5" />
    <circle cx="43" cy="30" r="3" fill="#2D1B00" />
    <circle cx="57" cy="30" r="3" fill="#2D1B00" />
    <circle cx="44" cy="29" r="1" fill="white" />
    <circle cx="58" cy="29" r="1" fill="white" />
    {/* Big nose */}
    <ellipse cx="50" cy="37" rx="4" ry="3" fill="#4A2C0A" />
    {/* Smile */}
    <path d="M44 43 Q50 48 56 43" stroke="#2D1B00" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Arms */}
    <line x1="30" y1="62" x2="14" y2="54" stroke="#8B5E3C" strokeWidth="8" strokeLinecap="round" />
    <line x1="70" y1="62" x2="86" y2="54" stroke="#8B5E3C" strokeWidth="8" strokeLinecap="round" />
    {/* Oversized feet */}
    <ellipse cx="40" cy="96" rx="16" ry="6" fill="#4A2C0A" />
    <ellipse cx="60" cy="96" rx="16" ry="6" fill="#4A2C0A" />
    {/* Legs */}
    <line x1="43" y1="86" x2="40" y2="94" stroke="#6B3F1F" strokeWidth="8" strokeLinecap="round" />
    <line x1="57" y1="86" x2="60" y2="94" stroke="#6B3F1F" strokeWidth="8" strokeLinecap="round" />
  </svg>
);

// Fighter — Anirudh: headband, intense eyebrows, fists up
const FighterAvatar = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#E63946" fillOpacity="0.15" />
    {/* Body */}
    <rect x="30" y="62" width="40" height="26" rx="8" fill="#E63946" />
    {/* Body stripe */}
    <rect x="47" y="62" width="6" height="26" fill="#C1121F" rx="0" />
    {/* Head */}
    <circle cx="50" cy="38" r="20" fill="#FDDCB5" />
    {/* Intense hair */}
    <path d="M32 30 Q34 16 50 18 Q66 16 68 30" fill="#1A1A1A" />
    {/* Headband */}
    <rect x="30" y="29" width="40" height="7" rx="3" fill="#E63946" />
    <path d="M78 30 L86 24 L84 26 L88 20" stroke="#E63946" strokeWidth="2" strokeLinecap="round" />
    {/* Intense eyebrows */}
    <path d="M36 38 L44 36" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    <path d="M56 36 L64 38" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    {/* Eyes (intense) */}
    <circle cx="42" cy="42" r="4" fill="#333" />
    <circle cx="58" cy="42" r="4" fill="#333" />
    <circle cx="43" cy="41" r="1.5" fill="white" />
    <circle cx="59" cy="41" r="1.5" fill="white" />
    {/* Determined mouth */}
    <path d="M44 52 L56 52" stroke="#8B5E3C" strokeWidth="2" strokeLinecap="round" />
    {/* Fists up */}
    <rect x="10" y="52" width="16" height="14" rx="5" fill="#FDDCB5" />
    <line x1="18" y1="66" x2="18" y2="56" stroke="#E0B080" strokeWidth="1" />
    <line x1="14" y1="54" x2="24" y2="54" stroke="#E0B080" strokeWidth="1" />
    <rect x="74" y="52" width="16" height="14" rx="5" fill="#FDDCB5" />
    <line x1="82" y1="66" x2="82" y2="56" stroke="#E0B080" strokeWidth="1" />
    <line x1="78" y1="54" x2="88" y2="54" stroke="#E0B080" strokeWidth="1" />
    {/* Arms connecting to fists */}
    <line x1="30" y1="70" x2="18" y2="62" stroke="#FDDCB5" strokeWidth="7" strokeLinecap="round" />
    <line x1="70" y1="70" x2="82" y2="62" stroke="#FDDCB5" strokeWidth="7" strokeLinecap="round" />
    {/* Legs */}
    <line x1="43" y1="86" x2="40" y2="97" stroke="#E63946" strokeWidth="7" strokeLinecap="round" />
    <line x1="57" y1="86" x2="60" y2="97" stroke="#E63946" strokeWidth="7" strokeLinecap="round" />
    {/* Shoes */}
    <ellipse cx="40" cy="97" rx="7" ry="3" fill="#1A1A1A" />
    <ellipse cx="60" cy="97" rx="7" ry="3" fill="#1A1A1A" />
  </svg>
);

// Chinese — Gautam: conical hat, champion silhouette
const ChineseAvatar = () => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#FFD166" fillOpacity="0.15" />
    {/* Body */}
    <rect x="30" y="62" width="40" height="26" rx="8" fill="#D62828" />
    {/* Collar/uniform details */}
    <path d="M50 62 L44 70 L50 72 L56 70 Z" fill="#F7B731" />
    {/* Head */}
    <circle cx="50" cy="40" r="18" fill="#F2C87A" />
    {/* Conical hat */}
    <polygon points="50,5 18,38 82,38" fill="#D62828" />
    <polygon points="50,8 22,36 78,36" fill="#C81D1D" />
    <ellipse cx="50" cy="37" rx="32" ry="5" fill="#8B0000" />
    {/* Hat center decoration */}
    <circle cx="50" cy="20" r="3" fill="#FFD166" />
    {/* Eyes (focused) */}
    <line x1="42" y1="40" x2="48" y2="40" stroke="#2D1B00" strokeWidth="2" strokeLinecap="round" />
    <line x1="52" y1="40" x2="58" y2="40" stroke="#2D1B00" strokeWidth="2" strokeLinecap="round" />
    {/* Eyebrows */}
    <path d="M40 36 Q45 34 48 36" stroke="#2D1B00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <path d="M52 36 Q55 34 60 36" stroke="#2D1B00" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {/* Smile */}
    <path d="M44 48 Q50 53 56 48" stroke="#8B5E3C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {/* Arms in champion pose */}
    <line x1="30" y1="68" x2="12" y2="56" stroke="#F2C87A" strokeWidth="6" strokeLinecap="round" />
    <line x1="70" y1="68" x2="88" y2="56" stroke="#F2C87A" strokeWidth="6" strokeLinecap="round" />
    {/* Racket (precision hold) */}
    <ellipse cx="90" cy="44" rx="6" ry="8" fill="none" stroke="#FFD166" strokeWidth="2" />
    <line x1="88" y1="52" x2="86" y2="60" stroke="#8B5E3C" strokeWidth="3" strokeLinecap="round" />
    {/* String lines on racket */}
    <line x1="90" y1="36" x2="90" y2="52" stroke="#FFD166" strokeWidth="0.5" />
    <line x1="86" y1="44" x2="94" y2="44" stroke="#FFD166" strokeWidth="0.5" />
    {/* Legs */}
    <line x1="43" y1="86" x2="40" y2="97" stroke="#D62828" strokeWidth="7" strokeLinecap="round" />
    <line x1="57" y1="86" x2="60" y2="97" stroke="#D62828" strokeWidth="7" strokeLinecap="round" />
  </svg>
);

// Custom avatar — emoji + color background
const CustomAvatar = ({ emoji = "🏸", color = "#6C63FF" }: { emoji?: string; color?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <circle cx="50" cy="50" r="48" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="2" strokeOpacity="0.5" />
    <circle cx="50" cy="50" r="36" fill={color} fillOpacity="0.15" />
    <text
      x="50"
      y="55"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="42"
      fill="#FFFFFF"
      style={{ fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif' }}
    >
      {emoji}
    </text>
  </svg>
);

export function AvatarSVG({ type, size = 64, emoji, color, className }: AvatarSVGProps) {
  const isCustom = type === "custom" || !["clumsy", "dwarf", "nerd", "bigfoot", "fighter", "chinese"].includes(type);

  if (isCustom) {
    const safeColor = color || "#6C63FF";
    const safeEmoji = emoji || "🏸";
    const fontSize = Math.round(size * 0.52);

    return (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: `${safeColor}25`,
          borderColor: `${safeColor}60`,
          fontSize: `${fontSize}px`,
        }}
        className={`rounded-full border-2 flex items-center justify-center select-none flex-shrink-0 shadow-sm ${className ?? ""}`}
      >
        <span
          className="leading-none flex items-center justify-center select-none pointer-events-none"
          style={{ transform: "translateY(-1px)" }}
        >
          {safeEmoji}
        </span>
      </div>
    );
  }

  const style: React.CSSProperties = { width: size, height: size };

  const avatar = (() => {
    switch (type) {
      case "clumsy": return <ClumsyAvatar />;
      case "dwarf": return <DwarfAvatar />;
      case "nerd": return <NerdAvatar />;
      case "bigfoot": return <BigfootAvatar />;
      case "fighter": return <FighterAvatar />;
      case "chinese": return <ChineseAvatar />;
      default: return <CustomAvatar emoji={emoji} color={color} />;
    }
  })();

  return (
    <div style={style} className={`flex-shrink-0 flex items-center justify-center ${className ?? ""}`}>
      {avatar}
    </div>
  );
}
