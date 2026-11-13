interface YouTubeEmbedResult {
  isYouTube: boolean;
  embedUrl: string;
}

/**
 * Hosts whose links carry a YouTube video id. The id pattern alone is not
 * enough: a direct video file such as `https://cdn.example.com/v/clip-000001`
 * also has an 11-character segment after `v/`, and treating it as YouTube
 * would put a plain video inside a YouTube player that cannot play it.
 */
const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'];

const isYouTubeHost = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return YOUTUBE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    // A scheme-less link ("youtu.be/…", "www.youtube.com/watch?v=…") is still a
    // YouTube link when its first segment names a YouTube host.
    const host = url.replace(/^\/\//, '').split(/[/?#]/)[0].toLowerCase();
    return YOUTUBE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }
};

export const getYouTubeEmbedInfo = (url?: string): YouTubeEmbedResult => {
  if (!url) return { isYouTube: false, embedUrl: '' };

  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = isYouTubeHost(url) ? url.match(regExp) : null;

  if (match && match[2] && match[2].length === 11) {
    const videoId = match[2];
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&autohide=1&enablejsapi=1`;
    return { isYouTube: true, embedUrl };
  }

  return { isYouTube: false, embedUrl: url };
};
