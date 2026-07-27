export interface YouTubeEmbedResult {
  isYouTube: boolean;
  embedUrl: string;
}

export const getYouTubeEmbedInfo = (url?: string): YouTubeEmbedResult => {
  if (!url) return { isYouTube: false, embedUrl: '' };

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);

  if (match && match[2] && match[2].length === 11) {
    const videoId = match[2];
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&autohide=1&enablejsapi=1`;
    return { isYouTube: true, embedUrl };
  }

  return { isYouTube: false, embedUrl: url };
};
