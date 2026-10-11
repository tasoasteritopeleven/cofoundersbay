import { Variants } from 'framer-motion';
import { useEffect, useState } from 'react';

export const ANIMATION_DURATION = {
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  page: 0.25,
} as const;

export const ANIMATION_EASE = {
  default: [0.25, 0.1, 0.25, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  smooth: [0.4, 0, 0.2, 1],
} as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: ANIMATION_DURATION.normal }
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASE.smooth }
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal }
  },
};

export const cardHover = {
  scale: 1.02,
  y: -2,
  transition: { duration: ANIMATION_DURATION.fast },
};

export const buttonTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: ANIMATION_DURATION.fast }
  },
  exit: { 
    opacity: 0,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 10,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: ANIMATION_DURATION.page }
  },
  exit: { 
    opacity: 0,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

export function getReducedMotionVariants(variants: Variants): Variants {
  const reduced: Variants = {};
  for (const key in variants) {
    const variant = variants[key];
    if (typeof variant === 'object' && variant !== null) {
      reduced[key] = {
        ...variant,
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0,
        transition: { duration: 0 },
      };
    } else {
      reduced[key] = variant;
    }
  }
  return reduced;
}

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

export function getAnimationVariants(variants: Variants, prefersReducedMotion: boolean): Variants {
  return prefersReducedMotion ? getReducedMotionVariants(variants) : variants;
}

// Utility for motion-safe animations with CSS
export const motionSafeClass = 'motion-safe:animate-in motion-reduce:animate-none';

// Skeleton pulse animation that respects reduced motion
export const skeletonPulse = {
  animate: {
    opacity: [0.5, 1, 0.5],
  },
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// Toast/notification slide in
export const toastSlideIn: Variants = {
  hidden: { opacity: 0, x: 50, scale: 0.95 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  exit: { 
    opacity: 0, 
    x: 50, 
    scale: 0.95,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

// Dropdown menu animation
export const dropdownMenu: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -5 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.fast, ease: ANIMATION_EASE.smooth }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: -5,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

// Accordion/collapse animation
export const accordionContent: Variants = {
  hidden: { height: 0, opacity: 0 },
  visible: { 
    height: 'auto', 
    opacity: 1,
    transition: { duration: ANIMATION_DURATION.normal, ease: ANIMATION_EASE.smooth }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

// Spinner rotation (respects reduced motion via CSS)
export const spinnerRotate = {
  animate: { rotate: 360 },
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: 'linear',
  },
};
