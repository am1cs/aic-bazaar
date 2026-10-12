import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MotionScene from './MotionScene';

const reducedQuery = '(prefers-reduced-motion: reduce)';
const pointerQuery = '(hover: hover) and (pointer: fine)';

function mediaPreference(media: string, initial: boolean) {
  const listeners = new Set<() => void>();
  return {
    media,
    matches: initial,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
    change(matches: boolean) {
      this.matches = matches;
      act(() => { for (const listener of [...listeners]) listener(); });
    },
  };
}

let reduced: ReturnType<typeof mediaPreference>;
let finePointer: ReturnType<typeof mediaPreference>;
let failConstructor = false;
let failObserve = false;
let observers: TestObserver[] = [];
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();

class TestObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  readonly observe = vi.fn((_target: Element) => {
    if (failObserve) throw new Error('Observation is unavailable');
  });
  readonly unobserve = vi.fn((_target: Element) => {});
  readonly disconnect = vi.fn(() => {});
  readonly takeRecords = () => [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    if (failConstructor) throw new Error('Observer setup is unavailable');
    observers.push(this);
  }

  emit(target: Element, isIntersecting: boolean) {
    act(() => this.callback([{ target, isIntersecting } as IntersectionObserverEntry], this));
  }
}

beforeEach(() => {
  reduced = mediaPreference(reducedQuery, false);
  finePointer = mediaPreference(pointerQuery, true);
  failConstructor = false;
  failObserve = false;
  observers = [];
  nextFrame = 0;
  frames.clear();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    if (query === reducedQuery) return reduced as unknown as MediaQueryList;
    if (query === pointerQuery) return finePointer as unknown as MediaQueryList;
    throw new Error(`Unexpected media query: ${query}`);
  }));
  vi.stubGlobal('IntersectionObserver', TestObserver);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('home-workbench')
      ? new DOMRect(0, 20, 400, 200)
      : new DOMRect(0, 2000, 400, 200);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixture(strict = false) {
  const content = <MotionScene>
    <div className="home-workbench" aria-label="Decorative storyboard">
      <div className="workbench-motion">Storyboard artwork</div>
    </div>
    <section className="home-section"><a href="/create">Create a deal</a></section>
    <section className="home-access"><input aria-label="Deal address" /></section>
  </MotionScene>;
  const view = render(strict ? <StrictMode>{content}</StrictMode> : content);
  return {
    ...view,
    scene: view.container.querySelector<HTMLElement>('.motion-scene')!,
    board: screen.getByLabelText('Decorative storyboard'),
    section: screen.getByRole('link', { name: 'Create a deal' }).closest('section')!,
    toggle: screen.getByRole('button', { name: 'Decorative motion' }),
  };
}

function movePointer(board: HTMLElement, clientX = 360, clientY = 190, pointerType = 'mouse') {
  const event = new MouseEvent('pointermove', { clientX, clientY, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  fireEvent(board, event);
}

function runFrame() {
  const entry = frames.entries().next().value;
  if (!entry) throw new Error('No animation frame is pending');
  const [id, callback] = entry;
  frames.delete(id);
  act(() => callback(0));
}

function expectNeutralPointer(board: HTMLElement) {
  for (const property of ['--tilt-x', '--tilt-y', '--pointer-x', '--pointer-y']) {
    expect(board.style.getPropertyValue(property)).toBe('');
  }
}

describe('landing motion safeguards', () => {
  it('leaves navigation and the deal input usable when observation is unsupported', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { scene, board } = fixture();
    expect(scene.hasAttribute('data-motion-ready')).toBe(false);
    expect(screen.getByRole('link', { name: 'Create a deal' }).getAttribute('href')).toBe('/create');
    const input = screen.getByRole('textbox', { name: 'Deal address' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'public-deal-address' } });
    expect(input.value).toBe('public-deal-address');
    movePointer(board);
    expect(frames.size).toBe(0);
  });

  it('fails open both when observer construction and attaching a target throw', () => {
    failConstructor = true;
    const first = fixture();
    expect(first.scene.hasAttribute('data-motion-ready')).toBe(false);
    expect(first.section.hasAttribute('aria-hidden')).toBe(false);
    first.unmount();

    failConstructor = false;
    failObserve = true;
    const second = fixture();
    expect(second.scene.hasAttribute('data-motion-ready')).toBe(false);
    expect(observers[0].disconnect).toHaveBeenCalled();
    expect(second.board.classList.contains('is-in-view')).toBe(false);
    movePointer(second.board);
    expect(frames.size).toBe(0);
  });

  it('honors an initial reduced-motion preference before creating any observer or pointer work', () => {
    reduced.matches = true;
    const { scene, board, toggle } = fixture();
    expect(observers).toHaveLength(0);
    expect(scene.hasAttribute('data-motion-ready')).toBe(false);
    expect(scene.dataset.motionPaused).toBe('true');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    movePointer(board);
    expect(frames.size).toBe(0);
  });

  it('immediately removes enhancements and cancels pending pointer work when reduced motion changes', () => {
    const { scene, board, toggle } = fixture();
    const observer = observers[0];
    movePointer(board);
    runFrame();
    expect(board.style.getPropertyValue('--tilt-x')).not.toBe('');
    movePointer(board, 50, 40);
    expect(frames.size).toBe(1);

    reduced.change(true);
    expect(scene.dataset.motionPaused).toBe('true');
    expect(scene.hasAttribute('data-motion-ready')).toBe(false);
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    expect(observer.disconnect).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expectNeutralPointer(board);
    movePointer(board);
    expect(frames.size).toBe(0);
  });

  it('lets the user pause unseen content and resume with a fresh observer', () => {
    const { scene, board, section, toggle } = fixture();
    const observer = observers[0];
    expect(section.classList.contains('is-motion-visible')).toBe(false);
    movePointer(board);
    expect(frames.size).toBe(1);

    fireEvent.click(toggle);
    expect(toggle.textContent).toContain('Motion off');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(scene.dataset.motionPaused).toBe('true');
    expect(scene.hasAttribute('data-motion-ready')).toBe(false);
    expect(board.classList.contains('is-in-view')).toBe(false);
    expect(observer.disconnect).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expectNeutralPointer(board);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(scene.dataset.motionPaused).toBe('false');
    expect(scene.dataset.motionReady).toBe('true');
    expect(observers).toHaveLength(2);
    expect(board.classList.contains('is-in-view')).toBe(true);
  });

  it('ignores callbacks from the observer discarded by StrictMode cleanup', () => {
    const { board, section } = fixture(true);
    expect(observers).toHaveLength(2);
    const [stale, current] = observers;
    expect(stale.disconnect).toHaveBeenCalled();
    stale.emit(section, true);
    stale.emit(board, false);
    expect(section.classList.contains('is-motion-visible')).toBe(false);
    expect(board.classList.contains('is-in-view')).toBe(true);

    current.emit(section, true);
    expect(section.classList.contains('is-motion-visible')).toBe(true);
    expect(current.unobserve).toHaveBeenCalledWith(section);
  });

  it('coalesces pointer movement and cancels it when the pointer or board leaves', () => {
    const { board } = fixture();
    movePointer(board);
    movePointer(board, 380, 210);
    expect(frames.size).toBe(1);
    runFrame();
    expect(board.style.getPropertyValue('--tilt-y')).not.toBe('');
    movePointer(board, 30, 40);
    fireEvent(board, new Event('pointerleave'));
    expect(frames.size).toBe(0);
    expectNeutralPointer(board);

    movePointer(board);
    expect(frames.size).toBe(1);
    observers[0].emit(board, false);
    expect(board.classList.contains('is-in-view')).toBe(false);
    expect(frames.size).toBe(0);
    expectNeutralPointer(board);
    movePointer(board);
    expect(frames.size).toBe(0);
  });

  it('stops pointer work when the input capability changes and ignores touch movement', () => {
    const { board } = fixture();
    movePointer(board, 360, 190, 'touch');
    expect(frames.size).toBe(0);
    movePointer(board);
    runFrame();
    movePointer(board);
    finePointer.change(false);
    expect(frames.size).toBe(0);
    expectNeutralPointer(board);
    movePointer(board);
    expect(frames.size).toBe(0);

    finePointer.change(true);
    movePointer(board);
    expect(frames.size).toBe(1);
  });

  it('updates bounded scroll progress as the scene passes and coalesces scroll with resize', () => {
    const { board, section } = fixture();
    let boardTop = 20;
    let sectionTop = 2000;
    Object.defineProperty(board, 'offsetTop', { get: () => boardTop, configurable: true });
    Object.defineProperty(board, 'offsetHeight', { value: 200, configurable: true });
    Object.defineProperty(section, 'offsetTop', { get: () => sectionTop, configurable: true });
    boardTop = -300;
    sectionTop = window.innerHeight * .5;
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(frames.size).toBe(1);
    runFrame();
    expect(Number(board.style.getPropertyValue('--scroll-progress'))).toBe(1);
    expect(Number(section.style.getPropertyValue('--scroll-reveal'))).toBeGreaterThan(.5);

    boardTop = 2000;
    sectionTop = -2000;
    fireEvent.scroll(window);
    runFrame();
    expect(Number(board.style.getPropertyValue('--scroll-progress'))).toBe(0);
    expect(Number(section.style.getPropertyValue('--scroll-reveal'))).toBe(1);
  });

  it('cancels scroll work on pause and ignores a late callback after unmount', () => {
    const { board, section, toggle, unmount } = fixture();
    fireEvent.scroll(window);
    const pending = frames.values().next().value!;
    fireEvent.click(toggle);
    expect(frames.size).toBe(0);
    expect(board.style.getPropertyValue('--scroll-progress')).toBe('');
    expect(section.style.getPropertyValue('--scroll-reveal')).toBe('');
    act(() => pending(0));
    expect(board.style.getPropertyValue('--scroll-progress')).toBe('');
    fireEvent.scroll(window);
    expect(frames.size).toBe(0);

    fireEvent.click(toggle);
    fireEvent.resize(window);
    const resumed = frames.values().next().value!;
    unmount();
    expect(frames.size).toBe(0);
    act(() => resumed(0));
    expect(board.style.getPropertyValue('--scroll-progress')).toBe('');
    fireEvent.scroll(window);
    expect(frames.size).toBe(0);
  });
});
