import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Address, Confirmation, External } from './components';

const writeText = vi.fn<(text: string) => Promise<void>>();
let originalClipboard: PropertyDescriptor | undefined;

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('safe external links', () => {
  it('renders valid HTTPS links with a protected new-tab target', () => {
    render(<External href="https://example.com/a%20b">Open material</External>);
    const link = screen.getByRole('link', { name: /Open material/ });
    expect(link.getAttribute('href')).toBe('https://example.com/a%20b');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([
    'http://example.com', 'javascript:alert(1)', 'https://@example.com', 'https:///example.com',
    'https://example.com/\u007f', 'https://example.com/\u0080', 'https://example.com\\path',
  ])('keeps a URL rejected by the form policy inert: %j', (href) => {
    render(<External href={href}>Open material</External>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Link is unavailable or invalid.')).toBeDefined();
  });

  it('applies the same 200 UTF-8 byte limit used for submitted links', () => {
    const prefix = 'https://example.com/';
    const exact = prefix + 'a'.repeat(200 - prefix.length);
    const view = render(<External href={exact}>Open material</External>);
    expect(screen.getByRole('link').getAttribute('href')).toBe(exact);
    view.rerender(<External href={exact + 'a'}>Open material</External>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('address copy feedback', () => {
  it('announces successful copying through a persistent polite live region', async () => {
    render(<Address value="public-address-a" label="creator wallet" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: 'Copy creator wallet' }));
    await waitFor(() => expect(status.textContent).toBe('creator wallet copied to clipboard.'));
    expect(writeText).toHaveBeenCalledExactlyOnceWith('public-address-a');
    expect(screen.getByRole('button', { name: 'Copy creator wallet' }).textContent).toBe('Copied');
  });

  it('keeps the address available and announces an actionable clipboard failure', async () => {
    writeText.mockRejectedValue(new Error('Clipboard unavailable'));
    render(<Address value="public-address-a" label="creator wallet" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy creator wallet' }));
    const error = await screen.findByText('Copy unavailable. Select the address below.');
    expect(error.getAttribute('role')).toBe('status');
    expect(screen.getByText('public-address-a')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy creator wallet' }).textContent).toBe('Copy');
  });

  it.each(['success', 'failure'] as const)('ignores late %s feedback after the displayed address changes', async (outcome) => {
    const pending = deferred();
    writeText.mockReturnValueOnce(pending.promise);
    const view = render(<Address value="public-address-a" label="creator wallet" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy creator wallet' }));
    view.rerender(<Address value="public-address-b" label="creator wallet" />);
    await act(async () => {
      if (outcome === 'success') pending.resolve();
      else pending.reject(new Error('Old clipboard request failed'));
      await pending.promise.catch(() => {});
    });
    expect(screen.getByText('public-address-b')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy creator wallet' }).textContent).toBe('Copy');
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByText('Copy unavailable. Select the address below.')).toBeNull();
  });
});

function ConfirmationHarness({ removeOpener = false, disableOpener = false, busy = false }: {
  removeOpener?: boolean; disableOpener?: boolean; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    {!removeOpener && <button disabled={disableOpener} onClick={() => setOpen(true)}>Review operation</button>}
    {open && <Confirmation title="Review the operation" busy={busy} onConfirm={() => {}} onClose={() => setOpen(false)}>
      <p>Review the public deal terms before signing.</p>
    </Confirmation>}
  </>;
}

function openConfirmation() {
  const opener = screen.getByRole('button', { name: 'Review operation' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe('confirmation keyboard focus', () => {
  it('focuses the review region and returns to its opener on Back, including StrictMode effect replay', () => {
    render(<StrictMode><ConfirmationHarness /></StrictMode>);
    const opener = openConfirmation();
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Review the operation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('region', { name: 'Review the operation' })).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it.each(['removed', 'disabled'] as const)('closes safely when its opener has been %s', (condition) => {
    const view = render(<ConfirmationHarness />);
    const opener = openConfirmation();
    view.rerender(<ConfirmationHarness removeOpener={condition === 'removed'} disableOpener={condition === 'disabled'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('region', { name: 'Review the operation' })).toBeNull();
    expect(document.activeElement).not.toBe(opener);
  });

  it('keeps confirmation and Back disabled during a pending operation', () => {
    render(<ConfirmationHarness busy />);
    openConfirmation();
    const back = screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Confirm in wallet' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(back);
    expect(screen.getByRole('region', { name: 'Review the operation' })).toBeDefined();
  });
});
