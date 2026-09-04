'use client';

import { useEffect, useRef } from 'react';

export function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    
    // Fast math lookup or simple constants
    const PI2 = Math.PI * 2;
    
    // Performance optimization: debounce resize
    let resizeTimeout: ReturnType<typeof setTimeout>;
    
    const handleResize = () => {
      // Performance: Cap device pixel ratio to 1.5 to save fill rate on ultra high-res displays
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      initParticles();
    };

    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 200);
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      angle: number;
      spin: number;
      color: string;
      glowColor: string | null;

      constructor() {
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.size = Math.random() * 2.5 + 0.5;
        this.speedX = Math.random() * 0.2 - 0.1;
        this.speedY = Math.random() * 0.2 - 0.1;
        this.opacity = Math.random() * 0.4 + 0.05;
        this.angle = Math.random() * PI2;
        this.spin = (Math.random() - 0.5) * 0.015;
        
        // Cache colors to avoid string interpolation in the render loop
        this.color = `rgba(215, 149, 24, ${this.opacity.toFixed(2)})`;
        this.glowColor = this.size > 1.8 ? `rgba(215, 149, 24, ${(this.opacity * 0.15).toFixed(2)})` : null;
      }

      update(mouseX: number, mouseY: number) {
        this.x += this.speedX;
        this.y += this.speedY;
        this.angle += this.spin;

        if (mouseX > 0 && mouseY > 0) {
          const dx = mouseX - this.x;
          const dy = mouseY - this.y;
          // Performance: approximate distance is faster than Math.sqrt, but Math.sqrt is fine for < 100 particles
          // Avoid Math.sqrt if dx and dy are definitely outside repel bounds
          if (Math.abs(dx) < 140 && Math.abs(dy) < 140) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 140) {
              const force = (140 - distance) / 140;
              this.x -= (dx / distance) * force * 2.5;
              this.y -= (dy / distance) * force * 2.5;
            }
          }
        }

        // Fast sine approx or just use Math.sin (JS engines optimize it well)
        this.x += Math.sin(this.angle) * 0.2;
        this.y += Math.cos(this.angle) * 0.2;

        if (this.x < -20) this.x = window.innerWidth + 20;
        else if (this.x > window.innerWidth + 20) this.x = -20;
        
        if (this.y < -20) this.y = window.innerHeight + 20;
        else if (this.y > window.innerHeight + 20) this.y = -20;
      }

      draw() {
        if (!ctx) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, PI2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        if (this.glowColor) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size * 2.5, 0, PI2);
          ctx.fillStyle = this.glowColor;
          ctx.fill();
        }
      }
    }

    const initParticles = () => {
      particles = [];
      const isMobile = window.innerWidth < 768;
      const numberOfParticles = isMobile ? 30 : Math.min(window.innerWidth / 12, 100);
      for (let i = 0; i < numberOfParticles; i++) {
        particles.push(new Particle());
      }
    };

    let mouseX = -1000;
    let mouseY = -1000;
    
    // Smooth mouse position for inertia
    let currentMouseX = -1000;
    let currentMouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('resize', debouncedResize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    
    handleResize();

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      
      // Interpolate mouse for smooth physics feel
      currentMouseX += (mouseX - currentMouseX) * 0.1;
      currentMouseY += (mouseY - currentMouseY) * 0.1;

      particles.forEach(p => {
        p.update(currentMouseX, currentMouseY);
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();

    return () => {
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1, opacity: 0.8 }}
      aria-hidden="true"
    />
  );
}
