import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeliveryPreview } from './DeliveryPreview';

afterEach(cleanup);

describe('saved delivery material preview', () => {
  it.each(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'apng', 'bmp', 'ico'])('previews a direct %s image from the saved HTTPS URL', (extension) => {
    const url = `https://example.com/delivery/concept.${extension}`;
    render(<DeliveryPreview url={url} label="Concept delivery" />);
    const image = screen.getByRole('img', { name: 'Concept delivery preview' });
    expect(image.getAttribute('src')).toBe(url);
    expect(screen.getByRole('status').textContent).toBe('Loading delivery preview…');
    fireEvent.load(image);
    expect(screen.queryByRole('status')).toBeNull();
    const link = screen.getByRole('link', { name: /Open delivery link/ });
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('uses the pathname extension with uppercase filenames and signed query parameters', () => {
    const url = 'https://example.com/CONCEPT.SVG?signature=123&download=0#view';
    render(<DeliveryPreview url={url} />);
    expect(screen.getByRole('img').getAttribute('src')).toBe(url);
  });

  it('plays a direct MP4 with native controls and no autoplay', () => {
    const url = 'https://example.com/DRAFT.MP4?signature=123#t=1';
    const { container } = render(<DeliveryPreview url={url} label="Draft delivery" />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe(url);
    expect(video.getAttribute('aria-label')).toBe('Draft delivery video');
    expect(video.controls).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.preload).toBe('metadata');
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute('autoplay')).toBe(false);
    fireEvent.loadedMetadata(video);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('link').getAttribute('href')).toBe(url);
  });

  it.each(['image', 'video'] as const)('keeps the external delivery link and gives an accessible message after a %s preview failure', (kind) => {
    const url = `https://example.com/unavailable.${kind === 'image' ? 'png' : 'mp4'}`;
    const { container } = render(<DeliveryPreview url={url} />);
    const media = container.querySelector(kind === 'image' ? 'img' : 'video')!;
    fireEvent.error(media);
    expect(screen.getByRole('status').textContent).toContain('Preview unavailable.');
    expect(screen.getByRole('status').textContent).toContain('Open the delivery link');
    expect(container.querySelector('img, video')).toBeNull();
    expect(screen.getByRole('link', { name: /Open delivery link/ }).getAttribute('href')).toBe(url);
  });

  it.each([
    'https://example.com/document.pdf',
    'https://drive.example.com/shared/material',
    'https://example.com/preview.html',
    'https://example.com/download?filename=concept.svg',
  ])('offers an external link for a URL without a supported direct media extension: %s', (url) => {
    const { container } = render(<DeliveryPreview url={url} />);
    expect(container.querySelector('img, video, iframe')).toBeNull();
    expect(screen.getByText('Open the delivery link to view the material.')).toBeDefined();
    expect(screen.getByRole('link').getAttribute('href')).toBe(url);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each([
    'http://example.com/concept.svg',
    'javascript:alert(1)',
    'data:image/svg+xml,<svg/>',
    'https:///example.com/concept.svg',
    'https://user:password@example.com/concept.svg',
    'https://example.com/concept.svg\u0000',
    'https://example.com\\concept.svg',
    '',
    'https://example.com/' + 'x'.repeat(201) + '.svg',
  ])('does not expose an unsafe or invalid URL as a link or media source: %j', (url) => {
    const { container } = render(<DeliveryPreview url={url} />);
    expect(container.querySelector('a, img, video, iframe')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Ask the creator for a valid HTTPS delivery link.');
  });

  it('resets a failed preview after the saved delivery URL changes and ignores old media events', () => {
    const view = render(<DeliveryPreview url="https://example.com/old.svg" />);
    const oldImage = screen.getByRole('img');
    fireEvent.error(oldImage);
    expect(screen.getByRole('status').textContent).toContain('Preview unavailable.');
    view.rerender(<DeliveryPreview url="https://example.com/revised.svg" />);
    const newImage = screen.getByRole('img');
    expect(newImage.getAttribute('src')).toBe('https://example.com/revised.svg');
    expect(screen.getByRole('status').textContent).toBe('Loading delivery preview…');
    fireEvent.error(oldImage);
    expect(screen.getByRole('img')).toBe(newImage);
    expect(screen.getByRole('status').textContent).toBe('Loading delivery preview…');
    fireEvent.load(newImage);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('retries a preview when a new submission revision keeps the same delivery URL', () => {
    const view = render(<DeliveryPreview url="https://example.com/replaced.svg" revision={1} />);
    fireEvent.error(screen.getByRole('img'));
    view.rerender(<DeliveryPreview url="https://example.com/replaced.svg" revision={2} />);
    expect(screen.getByRole('img')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Loading delivery preview…');
  });
});
