import { describe, expect, it } from 'vitest';
import { getYouTubeEmbedInfo } from '../components/Canvas/renderers/utils/youtubeHelper';

const ID = 'dQw4w9WgXcQ';

describe('getYouTubeEmbedInfo', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?feature=share&v=${ID}`,
    `https://youtu.be/${ID}?t=10`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://m.youtube.com/watch?v=${ID}#t=5`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `youtu.be/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
  ])('embeds %s', (url) => {
    const info = getYouTubeEmbedInfo(url);
    expect(info.isYouTube).toBe(true);
    expect(info.embedUrl.startsWith(`https://www.youtube.com/embed/${ID}?`)).toBe(true);
    expect(info.embedUrl).toContain(`playlist=${ID}`);
  });

  it('returns an empty result for no link', () => {
    expect(getYouTubeEmbedInfo(undefined)).toEqual({ isYouTube: false, embedUrl: '' });
    expect(getYouTubeEmbedInfo('')).toEqual({ isYouTube: false, embedUrl: '' });
  });

  it('keeps a direct video link as it is', () => {
    expect(getYouTubeEmbedInfo('https://cdn.example.com/clip.mp4')).toEqual({ isYouTube: false, embedUrl: 'https://cdn.example.com/clip.mp4' });
  });

  it('does not treat another host with a v/ segment as YouTube', () => {
    const url = 'https://cdn.example.com/v/clip-000001';
    expect(getYouTubeEmbedInfo(url)).toEqual({ isYouTube: false, embedUrl: url });
  });

  it('does not trust a host that only contains the word youtube', () => {
    const url = `https://youtube.com.evil.example/watch?v=${ID}`;
    expect(getYouTubeEmbedInfo(url).isYouTube).toBe(false);
  });

  it('refuses an id of the wrong length', () => {
    expect(getYouTubeEmbedInfo('https://www.youtube.com/watch?v=short').isYouTube).toBe(false);
  });
});
