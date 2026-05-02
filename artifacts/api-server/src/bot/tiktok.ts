import { logger } from "../lib/logger.js";

export interface TikTokProfile {
  username: string;
  secUid: string;
  nickname: string;
  followers: number;
  following: number;
  totalLikes: number;
  videoCount: number;
  bio: string;
  avatarUrl: string;
  verified: boolean;
}

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export async function fetchTikTokProfile(
  username: string
): Promise<TikTokProfile | null> {
  try {
    const res = await fetch(
      `https://www.tiktok.com/@${encodeURIComponent(username)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return null;
    const html = await res.text();

    // Extract __UNIVERSAL_DATA_FOR_REHYDRATION__
    const match = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match) return null;

    const data = JSON.parse(match[1]) as Record<string, unknown>;
    const scope = (data.__DEFAULT_SCOPE__ as Record<string, unknown>) ?? {};
    const userDetail = scope["webapp.user-detail"] as
      | Record<string, unknown>
      | undefined;
    const userInfo = userDetail?.userInfo as
      | Record<string, unknown>
      | undefined;
    if (!userInfo) return null;

    const user = userInfo.user as Record<string, unknown>;
    const stats = userInfo.stats as Record<string, unknown>;

    return {
      username: (user.uniqueId as string) || username,
      secUid: (user.secUid as string) || "",
      nickname: (user.nickname as string) || username,
      followers: (stats.followerCount as number) || 0,
      following: (stats.followingCount as number) || 0,
      totalLikes: Math.abs((stats.heartCount as number) || 0),
      videoCount: (stats.videoCount as number) || 0,
      bio: (user.signature as string) || "",
      avatarUrl:
        (user.avatarLarger as string) ||
        (user.avatarMedium as string) ||
        (user.avatarThumb as string) ||
        "",
      verified: Boolean(user.verified),
    };
  } catch (err) {
    logger.error({ err, username }, "Failed to fetch TikTok profile");
    return null;
  }
}
