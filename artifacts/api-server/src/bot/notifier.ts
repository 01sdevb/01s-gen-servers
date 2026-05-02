import { type Client, EmbedBuilder, type TextChannel } from "discord.js";
import { logger } from "../lib/logger.js";
import { fetchTikTokProfile } from "./tiktok.js";
import {
  getWatches,
  updateVideoCount,
  updateUserStats,
} from "./store.js";
import { WATERMARK } from "./games.js";

export const NOTIFY_CHANNEL_ID = "1500215767239495780";
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

async function pollAll(client: Client): Promise<void> {
  const watches = getWatches();
  if (watches.length === 0) return;

  logger.info({ count: watches.length }, "TikTok poll started");

  for (const watched of watches) {
    try {
      const profile = await fetchTikTokProfile(watched.username);
      if (!profile) {
        logger.warn({ username: watched.username }, "Could not fetch TikTok profile during poll");
        continue;
      }

      const newCount = profile.videoCount;
      const oldCount = watched.lastVideoCount;

      // Update stats regardless
      updateUserStats(
        watched.username,
        profile.followers,
        profile.totalLikes,
        profile.avatarUrl,
        profile.nickname
      );

      if (newCount > oldCount && oldCount > 0) {
        const diff = newCount - oldCount;
        logger.info({ username: watched.username, oldCount, newCount }, "New TikTok video(s) detected");

        const channel = client.channels.cache.get(NOTIFY_CHANNEL_ID) as
          | TextChannel
          | undefined;
        if (!channel) {
          logger.warn({ channelId: NOTIFY_CHANNEL_ID }, "Notify channel not found in cache");
          continue;
        }

        const embed = new EmbedBuilder()
          .setColor(0x010101)
          .setAuthor({
            name: `@${profile.username}${profile.verified ? " ✓" : ""}`,
            iconURL: profile.avatarUrl || undefined,
            url: `https://www.tiktok.com/@${profile.username}`,
          })
          .setTitle(
            diff === 1
              ? "🎬 ¡Nuevo video publicado!"
              : `🎬 ¡${diff} nuevos videos publicados!`
          )
          .setURL(`https://www.tiktok.com/@${profile.username}`)
          .setDescription(
            `**${profile.nickname}** acaba de subir ${diff === 1 ? "un nuevo video" : `${diff} videos`} a TikTok.\n\n` +
            `[👉 Ver en TikTok](https://www.tiktok.com/@${profile.username})`
          )
          .addFields(
            {
              name: "👥 Seguidores",
              value: formatNumber(profile.followers),
              inline: true,
            },
            {
              name: "❤️ Likes totales",
              value: formatNumber(profile.totalLikes),
              inline: true,
            },
            {
              name: "🎥 Videos totales",
              value: profile.videoCount.toString(),
              inline: true,
            }
          )
          .setFooter({ text: WATERMARK })
          .setTimestamp();

        if (profile.avatarUrl) embed.setThumbnail(profile.avatarUrl);

        await channel.send({ embeds: [embed] });
      }

      updateVideoCount(watched.username, newCount);

      // Small delay between users to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2_000));
    } catch (err) {
      logger.error({ err, username: watched.username }, "Error polling TikTok user");
    }
  }
}

export function startTikTokPoller(client: Client): void {
  // Wait for Discord to be ready before polling
  const run = async () => {
    try {
      await pollAll(client);
    } catch (err) {
      logger.error({ err }, "TikTok poller error");
    }
  };

  // Start first poll after 30 seconds (let bot fully connect)
  setTimeout(() => {
    run();
    setInterval(run, POLL_INTERVAL_MS);
  }, 30_000);

  logger.info({ intervalMs: POLL_INTERVAL_MS }, "TikTok poller scheduled");
}
