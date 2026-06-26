/**
 * Convert seconds to MM:SS or HH:MM:SS format.
 */
export function secondsToFormatted(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds.
 */
export function parseIso8601Duration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);

  if (!match) return 0;

  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds as a human-readable duration label (e.g. "1h 2m").
 */
export function formatDurationLabel(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Build a YouTube watch URL with optional timestamp deep link.
 */
export function buildYoutubeWatchUrl(
  videoId: string,
  startSeconds?: number
): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;

  if (startSeconds !== undefined && startSeconds > 0) {
    return `${base}&t=${Math.floor(startSeconds)}s`;
  }

  return base;
}
