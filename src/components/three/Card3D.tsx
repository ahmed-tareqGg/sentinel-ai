import { useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  glowColor?: string;
}

export function Card3D({ children, className, intensity = 12, glowColor }: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * intensity;
    const rotY = ((x - cx) / cx) * -intensity;

    card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02,1.02,1.02)`;

    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(circle at ${x}px ${y}px, ${glowColor || 'hsl(var(--primary) / 0.12)'} 0%, transparent 65%)`;
    }
  }, [intensity, glowColor]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    if (glowRef.current) glowRef.current.style.background = 'transparent';
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn('relative transition-transform duration-100 will-change-transform', className)}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Glow overlay */}
      <div
        ref={glowRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none z-10 transition-none"
      />
      {children}
    </div>
  );
}
