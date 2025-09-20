// Animation utilities for micro-interactions and visualizations
import { AnimationConfig, InteractionPoint } from '@/types';

// Easing functions
export const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  elasticOut: (t: number) => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  },
  bounceOut: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }
};

// Animation controller class
export class AnimationController {
  private animations: Map<string, any> = new Map();
  private rafId: number | null = null;

  start(
    id: string,
    from: number,
    to: number,
    config: AnimationConfig,
    onUpdate: (value: number) => void,
    onComplete?: () => void
  ) {
    const startTime = performance.now();
    const easingFn = easings[config.easing as keyof typeof easings] || easings.easeInOut;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime - (config.delay || 0);
      
      if (elapsed < 0) {
        this.rafId = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / config.duration, 1);
      const easedProgress = easingFn(progress);
      const currentValue = from + (to - from) * easedProgress;

      onUpdate(currentValue);

      if (progress < 1) {
        this.animations.set(id, animate);
        this.rafId = requestAnimationFrame(animate);
      } else {
        this.animations.delete(id);
        onComplete?.();
      }
    };

    this.animations.set(id, animate);
    this.rafId = requestAnimationFrame(animate);
  }

  stop(id: string) {
    this.animations.delete(id);
    if (this.animations.size === 0 && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  stopAll() {
    this.animations.clear();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// Spring animation
export const springAnimation = (
  from: number,
  to: number,
  config: { stiffness?: number; damping?: number; mass?: number } = {}
) => {
  const { stiffness = 100, damping = 10, mass = 1 } = config;
  
  let position = from;
  let velocity = 0;
  const amplitude = to - from;
  
  return (deltaTime: number): { value: number; finished: boolean } => {
    const springForce = -stiffness * (position - to);
    const dampingForce = -damping * velocity;
    const acceleration = (springForce + dampingForce) / mass;
    
    velocity += acceleration * deltaTime;
    position += velocity * deltaTime;
    
    const finished = Math.abs(position - to) < 0.01 && Math.abs(velocity) < 0.01;
    
    return { value: position, finished };
  };
};

// Gesture recognition utilities
export const recognizeGesture = (points: InteractionPoint[]): string => {
  if (points.length < 2) return 'tap';
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const distance = Math.sqrt(
    Math.pow(lastPoint.x - firstPoint.x, 2) + 
    Math.pow(lastPoint.y - firstPoint.y, 2)
  );
  const duration = lastPoint.timestamp - firstPoint.timestamp;
  
  if (distance < 10 && duration < 200) return 'tap';
  if (distance > 50 && duration < 300) return 'swipe';
  if (distance < 20 && duration > 500) return 'longpress';
  
  return 'drag';
};

// Parallax effect calculator
export const calculateParallax = (
  scrollY: number,
  elementY: number,
  speed: number = 0.5
): number => {
  const relativeScroll = scrollY - elementY;
  return relativeScroll * speed;
};

// Smooth scroll behavior
export const smoothScrollTo = (
  targetY: number,
  duration: number = 1000,
  callback?: () => void
) => {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  const scroll = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easings.easeInOutCubic(progress);
    
    window.scrollTo(0, startY + distance * ease);
    
    if (progress < 1) {
      requestAnimationFrame(scroll);
    } else {
      callback?.();
    }
  };

  requestAnimationFrame(scroll);
};

// Canvas animation helpers
export const drawSmoothLine = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string = '#FF7A00',
  lineWidth: number = 2
) => {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  // Use quadratic curves for smooth lines
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }

  // Last point
  if (points.length > 1) {
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  ctx.stroke();
};

// Particle system for visual effects
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;

  constructor(x: number, y: number, config: any = {}) {
    this.x = x;
    this.y = y;
    this.vx = config.vx || (Math.random() - 0.5) * 2;
    this.vy = config.vy || (Math.random() - 0.5) * 2;
    this.life = config.life || 1;
    this.maxLife = this.life;
    this.size = config.size || 2;
    this.color = config.color || '#FF7A00';
  }

  update(deltaTime: number) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.life -= deltaTime * 0.001;
    
    // Apply gravity
    this.vy += 0.1 * deltaTime;
    
    // Fade out
    this.size *= 0.99;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  isDead() {
    return this.life <= 0 || this.size < 0.1;
  }
}

// Ripple effect for buttons and interactive elements
export const createRipple = (
  element: HTMLElement,
  x: number,
  y: number,
  color: string = 'rgba(255, 122, 0, 0.3)'
) => {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  
  ripple.style.position = 'absolute';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = x - rect.left - size / 2 + 'px';
  ripple.style.top = y - rect.top - size / 2 + 'px';
  ripple.style.backgroundColor = color;
  ripple.style.borderRadius = '50%';
  ripple.style.transform = 'scale(0)';
  ripple.style.opacity = '1';
  ripple.style.pointerEvents = 'none';
  ripple.className = 'ripple-effect';
  
  element.appendChild(ripple);
  
  // Trigger animation
  requestAnimationFrame(() => {
    ripple.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out';
    ripple.style.transform = 'scale(2)';
    ripple.style.opacity = '0';
  });
  
  // Clean up
  setTimeout(() => {
    ripple.remove();
  }, 600);
};

// Morphing shape animation
export const morphPath = (
  fromPath: string,
  toPath: string,
  progress: number
): string => {
  // Simple linear interpolation between path commands
  // This is a simplified version - for complex morphing, use a library like flubber
  const fromCommands = fromPath.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  const toCommands = toPath.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];
  
  if (fromCommands.length !== toCommands.length) {
    return progress < 0.5 ? fromPath : toPath;
  }
  
  const morphedCommands = fromCommands.map((fromCmd, i) => {
    const toCmd = toCommands[i];
    const fromNumbers = fromCmd.match(/-?\d+\.?\d*/g)?.map(Number) || [];
    const toNumbers = toCmd.match(/-?\d+\.?\d*/g)?.map(Number) || [];
    
    if (fromNumbers.length !== toNumbers.length) {
      return progress < 0.5 ? fromCmd : toCmd;
    }
    
    const morphedNumbers = fromNumbers.map((fromNum, j) => {
      const toNum = toNumbers[j];
      return fromNum + (toNum - fromNum) * progress;
    });
    
    return fromCmd.replace(/-?\d+\.?\d*/g, () => String(morphedNumbers.shift()));
  });
  
  return morphedCommands.join(' ');
};

// Stagger animation for lists
export const staggerAnimation = (
  elements: HTMLElement[],
  property: string,
  from: string,
  to: string,
  duration: number = 300,
  staggerDelay: number = 50
) => {
  elements.forEach((element, index) => {
    setTimeout(() => {
      element.style.transition = `${property} ${duration}ms ease-out`;
      element.style[property as any] = from;
      
      requestAnimationFrame(() => {
        element.style[property as any] = to;
      });
    }, index * staggerDelay);
  });
};