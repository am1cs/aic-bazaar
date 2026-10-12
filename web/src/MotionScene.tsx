import { useEffect, useRef, useState, type ReactNode } from 'react';

const reducedQuery = '(prefers-reduced-motion: reduce)';
const pointerQuery = '(hover: hover) and (pointer: fine)';
const revealSelector = '.home-section, .home-protocol, .home-access, .feature-card, .demo-art';

function prefersReducedMotion() {
  try {
    return typeof window.matchMedia !== 'function' || window.matchMedia(reducedQuery).matches;
  } catch {
    return true;
  }
}

/** Landing-page decoration. Every unsupported or failed enhancement leaves content visible. */
export default function MotionScene({ children }: { children: ReactNode }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    let preference: MediaQueryList;
    try { preference = window.matchMedia(reducedQuery); } catch { return; }
    const update = () => setReduced(preference.matches);
    update();
    if (typeof preference.addEventListener === 'function') {
      preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }
    preference.addListener?.(update);
    return () => preference.removeListener?.(update);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || paused || reduced || typeof IntersectionObserver !== 'function') return;

    let active = true;
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    let scrollFrame = 0;
    let point = { x: 0, y: 0 };
    let finePointer: MediaQueryList | undefined;
    const board = scene.querySelector<HTMLElement>('.hero-experience, .home-workbench');
    const targets = [...scene.querySelectorAll<HTMLElement>(revealSelector)];
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const layoutTop = (element: HTMLElement) => {
      let top = 0;
      let parent: HTMLElement | null = element;
      while (parent) {
        top += parent.offsetTop;
        parent = parent.offsetParent as HTMLElement | null;
      }
      return top - window.scrollY;
    };
    const updateScroll = () => {
      if (!active) return;
      const height = Math.max(1, window.innerHeight);
      // Read untransformed layout first; decorative transforms never feed back into progress.
      const boardProgress = board ? clamp((height - layoutTop(board) - board.offsetHeight) / Math.max(height, board.offsetHeight, 1)) : 0;
      const reveals = targets.map(target => ({ target, progress: clamp((height * .9 - layoutTop(target)) / (height * .55)) }));
      if (board) {
        const progress = boardProgress;
        board.style.setProperty('--scroll-progress', progress.toFixed(3));
        board.style.setProperty('--scroll-shift', `${(progress * 140).toFixed(2)}px`);
        board.style.setProperty('--scroll-zoom', (1 + progress * .18).toFixed(3));
        board.style.setProperty('--scroll-rotation', `${(progress * 8).toFixed(2)}deg`);
      }
      for (const { target, progress } of reveals) {
        target.style.setProperty('--scroll-reveal', progress.toFixed(3));
      }
    };
    const scheduleScroll = () => {
      if (!active || scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        updateScroll();
      });
    };

    const resetPointer = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      for (const property of ['--tilt-x', '--tilt-y', '--pointer-x', '--pointer-y']) {
        board?.style.removeProperty(property);
      }
    };
    const movePointer = (event: PointerEvent) => {
      if (!active || !board || event.pointerType === 'touch' || !finePointer?.matches || !board.classList.contains('is-in-view')) return;
      point = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!active || !board.isConnected || !finePointer?.matches) return;
        const rect = board.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.max(-1, Math.min(1, ((point.x - rect.left) / rect.width - .5) * 2));
        const y = Math.max(-1, Math.min(1, ((point.y - rect.top) / rect.height - .5) * 2));
        board.style.setProperty('--tilt-x', `${(-y * 3).toFixed(2)}deg`);
        board.style.setProperty('--tilt-y', `${(x * 3).toFixed(2)}deg`);
        board.style.setProperty('--pointer-x', `${(x * 3).toFixed(2)}px`);
        board.style.setProperty('--pointer-y', `${(y * 3).toFixed(2)}px`);
      });
    };
    const configurePointer = () => {
      resetPointer();
      board?.removeEventListener('pointermove', movePointer);
      board?.removeEventListener('pointerleave', resetPointer);
      if (active && finePointer?.matches) {
        board?.addEventListener('pointermove', movePointer, { passive: true });
        board?.addEventListener('pointerleave', resetPointer);
      }
    };
    const cleanup = () => {
      active = false;
      observer?.disconnect();
      board?.removeEventListener('pointermove', movePointer);
      board?.removeEventListener('pointerleave', resetPointer);
      finePointer?.removeEventListener?.('change', configurePointer);
      window.removeEventListener('blur', resetPointer);
      window.removeEventListener('scroll', scheduleScroll);
      window.removeEventListener('resize', scheduleScroll);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      for (const property of ['--scroll-progress', '--scroll-shift', '--scroll-zoom', '--scroll-rotation']) {
        board?.style.removeProperty(property);
      }
      for (const target of targets) target.style.removeProperty('--scroll-reveal');
      resetPointer();
      board?.classList.remove('is-in-view');
      scene.removeAttribute('data-motion-ready');
    };

    try {
      observer = new IntersectionObserver(entries => {
        if (!active) return;
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (target === board) {
            target.classList.toggle('is-in-view', entry.isIntersecting);
            if (!entry.isIntersecting) resetPointer();
          } else if (entry.isIntersecting) {
            target.classList.add('is-motion-visible');
            observer?.unobserve(target);
          }
        }
      }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });

      for (const group of scene.querySelectorAll('.grid-three, .demo-gallery')) {
        [...group.children].forEach((child, index) => {
          (child as HTMLElement).style.setProperty('--reveal-delay', `${index * 85}ms`);
        });
      }
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        if (rect.top < window.innerHeight * .95 && rect.bottom > 0) {
          target.classList.add('is-motion-visible');
        } else {
          observer.observe(target);
        }
      }
      if (board) {
        const rect = board.getBoundingClientRect();
        board.classList.toggle('is-in-view', rect.top < window.innerHeight && rect.bottom > 0);
        observer.observe(board);
      }
      finePointer = window.matchMedia(pointerQuery);
      finePointer.addEventListener?.('change', configurePointer);
      configurePointer();
      window.addEventListener('blur', resetPointer);
      window.addEventListener('scroll', scheduleScroll, { passive: true });
      window.addEventListener('resize', scheduleScroll, { passive: true });
      updateScroll();
      // Hiding is armed last. If any setup step fails, the page stays readable.
      scene.dataset.motionReady = 'true';
    } catch {
      cleanup();
    }
    return cleanup;
  }, [paused, reduced]);

  return <div className="motion-scene" ref={sceneRef} data-motion-paused={paused || reduced ? 'true' : 'false'}>
    <div className="motion-toolbar"><button
      className="motion-toggle" type="button" aria-label="Decorative motion"
      aria-pressed={!paused && !reduced} disabled={reduced}
      title={reduced ? 'Motion is reduced in your device settings.' : 'Turn decorative motion on or off.'}
      onClick={() => setPaused(value => !value)}
    ><span aria-hidden="true">{paused || reduced ? '◌' : '✳'}</span>Motion {paused || reduced ? 'off' : 'on'}</button></div>
    {children}
  </div>;
}
