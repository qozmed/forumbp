
import React from 'react';
import { Role } from '../../types';

interface Props {
  role: Role;
  className?: string;
}

const RoleBadge: React.FC<Props> = ({ role, className = '' }) => {
  // We use CSS variables to pass the dynamic color to the keyframes
  const style = {
    '--role-color': role.color,
    // Helper to extract RGB for rgba usages in CSS
    '--role-rgb': hexToRgb(role.color)
  } as React.CSSProperties;

  let baseClass = "inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] border rounded select-none";
  let effectClass = "";

  // Base styling fallback if no effect
  let staticStyle: React.CSSProperties = {
    color: role.color,
    borderColor: role.color,
    backgroundColor: `${role.color}15` // 15 = ~8% opacity hex
  };

  switch (role.effect) {
    case 'gradient':
      effectClass = "effect-gradient";
      staticStyle = {}; // Gradient overrides everything
      break;
    case 'fire':
      effectClass = "effect-fire";
      break;
    case 'snow':
      effectClass = "effect-snow";
      staticStyle = { 
         color: role.color, 
         borderColor: role.color, 
         backgroundColor: '#000' 
      };
      break;
    case 'lightning':
      effectClass = "effect-lightning";
      staticStyle = {
        border: `1px solid ${role.color}`
      };
      break;
    case 'sparkle':
      effectClass = "effect-sparkle";
      break;
    case 'glitch':
      effectClass = "effect-glitch";
      break;
    default:
      // No effect, keep static style
      break;
  }

  return (
    <span 
      className={`${baseClass} ${effectClass} ${className}`} 
      style={{ ...style, ...staticStyle }}
    >
      {role.name}
    </span>
  );
};

// Helper to convert hex to r,g,b for CSS variables
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? 
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` 
    : '255, 255, 255';
}

export default RoleBadge;