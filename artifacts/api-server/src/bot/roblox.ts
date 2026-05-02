export interface RobloxServer {
  id: string;
  playing: number;
  maxPlayers: number;
  fps: number;
  ping: number;
}

export interface RobloxGameInfo {
  name: string;
  playing: number;
  visits: number;
  maxPlayers: number;
  created: string;
  updated: string;
  genre: string;
  creatorName: string;
  creatorType: string;
  creatorId: number;
  favoritedCount: number;
}

export async function getGameThumbnail(universeId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`
    );
    if (!res.ok) return null;
    const data = await res.json() as { data: { imageUrl: string }[] };
    return data.data?.[0]?.imageUrl ?? null;
  } catch {
    return null;
  }
}

export async function getGameThumbnailWide(universeId: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false`
    );
    if (!res.ok) return null;
    const data = await res.json() as { data: { thumbnails: { imageUrl: string }[] }[] };
    return data.data?.[0]?.thumbnails?.[0]?.imageUrl ?? null;
  } catch {
    return null;
  }
}

export async function getGameInfo(universeId: number): Promise<RobloxGameInfo | null> {
  try {
    const res = await fetch(
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      data: {
        name: string;
        playing: number;
        visits: number;
        maxPlayers: number;
        created: string;
        updated: string;
        genre: string;
        favoritedCount: number;
        creator: { name: string; type: string; id: number };
      }[];
    };
    const game = data.data?.[0];
    if (!game) return null;
    return {
      name: game.name,
      playing: game.playing,
      visits: game.visits,
      maxPlayers: game.maxPlayers,
      created: game.created,
      updated: game.updated,
      genre: game.genre ?? "N/A",
      favoritedCount: game.favoritedCount ?? 0,
      creatorName: game.creator?.name ?? "Desconocido",
      creatorType: game.creator?.type ?? "User",
      creatorId: game.creator?.id ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getPublicServer(placeId: number, targetPlayers: number): Promise<RobloxServer | null> {
  try {
    const allServers: RobloxServer[] = [];
    let cursor = "";
    const maxPages = 3;

    for (let page = 0; page < maxPages; page++) {
      const url =
        `https://games.roblox.com/v1/games/${placeId}/servers/Public?sortOrder=Asc&excludeFullGames=false&limit=100` +
        (cursor ? `&cursor=${cursor}` : "");
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json() as { data: RobloxServer[]; nextPageCursor?: string };
      if (!data.data || data.data.length === 0) break;
      allServers.push(...data.data);

      const exactMatch = data.data.find((s) => s.playing === targetPlayers);
      if (exactMatch) return exactMatch;

      if (!data.nextPageCursor) break;
      cursor = data.nextPageCursor;
    }

    if (allServers.length === 0) return null;

    const exact = allServers.filter((s) => s.playing === targetPlayers);
    if (exact.length > 0) {
      return exact[Math.floor(Math.random() * exact.length)] ?? null;
    }

    const sorted = [...allServers].sort(
      (a, b) => Math.abs(a.playing - targetPlayers) - Math.abs(b.playing - targetPlayers)
    );
    return sorted[0] ?? null;
  } catch {
    return null;
  }
}

export interface JoinLinks {
  web: string;
  deeplink: string;
}

export function buildJoinLink(placeId: number, jobId: string): JoinLinks {
  return {
    web: `https://www.roblox.com/games/${placeId}?gameInstanceId=${jobId}`,
    deeplink: `roblox://experiences/start?placeId=${placeId}&gameInstanceId=${jobId}`,
  };
}
