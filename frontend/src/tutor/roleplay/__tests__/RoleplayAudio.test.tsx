import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoleplayAudio } from '../RoleplayAudio';

describe('RoleplayAudio', () => {
  it('sets the audio element\'s src to the given URL', () => {
    const { container } = render(<RoleplayAudio url="https://example.test/a.mp3" onEnded={() => {}} />);
    const audio = container.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe('https://example.test/a.mp3');
  });

  it('renders with no src when the URL is null, rather than an empty string that would fetch the page itself', () => {
    const { container } = render(<RoleplayAudio url={null} onEnded={() => {}} />);
    const audio = container.querySelector('audio')!;
    expect(audio.hasAttribute('src')).toBe(false);
  });

  it('calls onEnded when the element fires its native "ended" event', () => {
    const onEnded = vi.fn();
    const { container } = render(<RoleplayAudio url="https://example.test/a.mp3" onEnded={onEnded} />);
    const audio = container.querySelector('audio')!;
    fireEvent.ended(audio);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('plays the new clip from the start when the URL changes to a different beat', () => {
    const { container, rerender } = render(<RoleplayAudio url="https://example.test/a.mp3" onEnded={() => {}} />);
    const audio = container.querySelector('audio')!;
    const playSpy = vi.spyOn(audio, 'play');

    rerender(<RoleplayAudio url="https://example.test/b.mp3" onEnded={() => {}} />);
    expect(audio.getAttribute('src')).toBe('https://example.test/b.mp3');
    expect(playSpy).toHaveBeenCalled();
  });

  it('does not re-trigger play on a re-render that carries the SAME url', () => {
    const { container, rerender } = render(<RoleplayAudio url="https://example.test/a.mp3" onEnded={() => {}} />);
    const audio = container.querySelector('audio')!;
    const playSpy = vi.spyOn(audio, 'play');

    // Same url, new function identity for onEnded — a realistic re-render.
    rerender(<RoleplayAudio url="https://example.test/a.mp3" onEnded={() => {}} />);
    expect(playSpy).not.toHaveBeenCalled();
  });
});
