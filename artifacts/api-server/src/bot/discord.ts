import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  type Message,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { ALLOWED_CHANNEL_ID, GAMES, WATERMARK } from "./games.js";
import {
  getGameThumbnail,
  getGameThumbnailWide,
  getGameInfo,
  getPublicServer,
  buildJoinLink,
  type JoinLinks,
} from "./roblox.js";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 60_000;

export function createDiscordBot(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info({ tag: c.user.tag }, "Discord bot connected");
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.channelId !== ALLOWED_CHANNEL_ID) return;

    const content = message.content.trim().toLowerCase();
    if (!content.startsWith("gen ") && content !== "gen") return;

    const parts = content.split(/\s+/);
    const keyword = parts[1];
    const subKeyword = parts[2];

    if (keyword === "info") {
      const gameKey = subKeyword;
      if (!gameKey || !GAMES[gameKey]) {
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("📋 gen info — Juegos disponibles")
              .setDescription(
                "Usa `gen info [juego]` para ver las estadísticas de un juego.\n\n" +
                  Object.entries(GAMES)
                    .map(([k, g]) => `${g.emoji} \`gen info ${k}\` → **${g.name}**`)
                    .join("\n")
              )
              .setFooter({ text: WATERMARK }),
          ],
        });
        return;
      }

      const game = GAMES[gameKey]!;
      const loadingEmbed = new EmbedBuilder()
        .setColor(game.color)
        .setTitle(`${game.emoji} Cargando info de ${game.name}...`)
        .setDescription("⏳ Consultando la API de Roblox...")
        .setFooter({ text: WATERMARK });

      const reply = await message.reply({ embeds: [loadingEmbed] });

      const [icon, banner, gameInfo] = await Promise.all([
        getGameThumbnail(game.universeId),
        getGameThumbnailWide(game.universeId),
        getGameInfo(game.universeId),
      ]);

      if (!gameInfo) {
        await reply.edit({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("❌ Error")
              .setDescription("No se pudo obtener la información del juego.")
              .setFooter({ text: WATERMARK }),
          ],
        });
        return;
      }

      const creatorUrl =
        gameInfo.creatorType === "Group"
          ? `https://www.roblox.com/groups/${gameInfo.creatorId}/`
          : `https://www.roblox.com/users/${gameInfo.creatorId}/profile`;

      const createdDate = new Date(gameInfo.created).toLocaleDateString("es-ES", {
        year: "numeric", month: "long", day: "numeric",
      });
      const updatedDate = new Date(gameInfo.updated).toLocaleDateString("es-ES", {
        year: "numeric", month: "long", day: "numeric",
      });

      const infoEmbed = new EmbedBuilder()
        .setColor(game.color)
        .setAuthor({ name: game.name, iconURL: icon ?? undefined })
        .setTitle(`${game.emoji} ${gameInfo.name}`)
        .setURL(`https://www.roblox.com/games/${game.placeId}`)
        .addFields(
          {
            name: "👥 Jugando ahora",
            value: `**${gameInfo.playing.toLocaleString()}**`,
            inline: true,
          },
          {
            name: "👁️ Visitas totales",
            value: `**${gameInfo.visits.toLocaleString()}**`,
            inline: true,
          },
          {
            name: "⭐ Favoritos",
            value: `**${gameInfo.favoritedCount.toLocaleString()}**`,
            inline: true,
          },
          {
            name: "🎮 Jugadores máx/servidor",
            value: `**${gameInfo.maxPlayers}**`,
            inline: true,
          },
          {
            name: "🎭 Género",
            value: gameInfo.genre,
            inline: true,
          },
          {
            name: "🛠️ Desarrollador",
            value: `[${gameInfo.creatorName}](${creatorUrl}) *(${gameInfo.creatorType === "Group" ? "Grupo" : "Usuario"})*`,
            inline: true,
          },
          {
            name: "📅 Creado",
            value: createdDate,
            inline: true,
          },
          {
            name: "🔄 Última actualización",
            value: updatedDate,
            inline: true,
          }
        )
        .setFooter({ text: WATERMARK })
        .setTimestamp();

      if (banner) infoEmbed.setImage(banner);
      if (icon) infoEmbed.setThumbnail(icon);

      await reply.edit({ embeds: [infoEmbed] });
      return;
    }

    const playerCount = Math.max(0, parseInt(subKeyword ?? "0", 10) || 0);

    const now = Date.now();
    const lastUsed = cooldowns.get(message.author.id) ?? 0;
    const remaining = COOLDOWN_MS - (now - lastUsed);

    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff8800)
            .setTitle("⏳ Cooldown activo")
            .setDescription(`Debes esperar **${seconds} segundo(s)** antes de generar otro servidor.`)
            .setFooter({ text: WATERMARK }),
        ],
      });
      return;
    }

    if (!keyword || !GAMES[keyword]) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("❌ Juego no encontrado")
            .setDescription(
              "**Juegos disponibles:**\n\n" +
                Object.entries(GAMES)
                  .map(([k, g]) => `${g.emoji} \`gen ${k} [jugadores]\` → **${g.name}**`)
                  .join("\n")
            )
            .setFooter({ text: WATERMARK }),
        ],
      });
      return;
    }

    const game = GAMES[keyword]!;

    cooldowns.set(message.author.id, Date.now());

    const loadingEmbed = new EmbedBuilder()
      .setColor(game.color)
      .setTitle(`${game.emoji} Generando servidor de ${game.name}...`)
      .setDescription(`⏳ Buscando servidor con **${playerCount}** jugador(es) actualmente...`)
      .setFooter({ text: WATERMARK });

    const reply = await message.reply({ embeds: [loadingEmbed] });

    try {
      const [icon, banner, gameInfo, server] = await Promise.all([
        getGameThumbnail(game.universeId),
        getGameThumbnailWide(game.universeId),
        getGameInfo(game.universeId),
        getPublicServer(game.placeId, playerCount),
      ]);

      const currentPlayers = gameInfo?.playing ?? 0;
      const maxPlayers = gameInfo?.maxPlayers ?? 0;
      const ping = client.ws.ping;

      const channelEmbed = new EmbedBuilder()
        .setColor(game.color)
        .setAuthor({ name: game.name, iconURL: icon ?? undefined })
        .setTitle(`${game.emoji} Generated Server — Look at your DM!`)
        .setDescription(`✅ Servidor encontrado con **${server?.playing ?? playerCount}** jugador(es) actualmente.`)
        .addFields(
          {
            name: "👥 Jugadores en línea",
            value: `**${currentPlayers.toLocaleString()}**`,
            inline: true,
          },
          {
            name: "🏓 Ping",
            value: `\`${ping}ms\``,
            inline: true,
          },
          {
            name: "🎮 Juego",
            value: game.name,
            inline: true,
          }
        )
        .setFooter({ text: WATERMARK })
        .setTimestamp();

      if (banner) channelEmbed.setImage(banner);
      if (icon) channelEmbed.setThumbnail(icon);

      await reply.edit({ embeds: [channelEmbed] });

      if (server) {
        const links: JoinLinks = buildJoinLink(game.placeId, server.id);
        const freeSlots = server.maxPlayers - server.playing;

        const isExact = server.playing === playerCount;
        const playerInfo = isExact
          ? `✅ Encontrado exacto: **${server.playing}** jugador(es) como pediste.`
          : `⚠️ No se encontró exacto. Pediste **${playerCount}**, el más cercano tiene **${server.playing}** jugador(es).`;

        const dmEmbed = new EmbedBuilder()
          .setColor(isExact ? game.color : 0xff8800)
          .setTitle(`${game.emoji} Tu servidor — ${game.name}`)
          .setDescription(
            `${playerInfo}\nToca el link web para entrar, o copia el deeplink si tienes Roblox instalado.`
          )
          .addFields(
            {
              name: "🔗 Link web (clickeable)",
              value: links.web,
              inline: false,
            },
            {
              name: "📱 Deeplink Roblox (toca para copiar)",
              value: `\`${links.deeplink}\``,
              inline: false,
            },
            {
              name: "🆔 Job ID",
              value: `\`${server.id}\``,
              inline: false,
            },
            {
              name: "👥 Pedido / Encontrado",
              value: `**${playerCount}** pedido → **${server.playing}** encontrado`,
              inline: true,
            },
            {
              name: "📊 Slots libres",
              value: `${freeSlots} de ${server.maxPlayers}`,
              inline: true,
            },
            {
              name: "🎮 Juego",
              value: game.name,
              inline: true,
            }
          )
          .setFooter({ text: WATERMARK })
          .setTimestamp();

        if (icon) dmEmbed.setThumbnail(icon);
        if (banner) dmEmbed.setImage(banner);

        try {
          await message.author.send({ embeds: [dmEmbed] });
        } catch {
          await message.channel.send({
            content: `<@${message.author.id}> ⚠️ No pude enviarte el DM. Abre tus DMs y vuelve a intentarlo.`,
          });
        }
      } else {
        const noDmEmbed = new EmbedBuilder()
          .setColor(0xff8800)
          .setTitle(`${game.emoji} ${game.name}`)
          .setDescription(
            `⚠️ No se encontró un servidor con **${playerCount}** espacio(s) disponible(s) ahora mismo.\nIntenta con menos jugadores o vuelve en unos segundos.`
          )
          .setFooter({ text: WATERMARK });

        await reply.edit({ embeds: [noDmEmbed] });

        try {
          await message.author.send({ embeds: [noDmEmbed] });
        } catch {
          logger.warn({ userId: message.author.id }, "Could not DM user");
        }
      }
    } catch (err) {
      logger.error({ err }, "Error handling gen command");
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Error")
        .setDescription("Ocurrió un error al generar el servidor. Inténtalo de nuevo.")
        .setFooter({ text: WATERMARK });
      await reply.edit({ embeds: [errorEmbed] });
    }
  });

  return client;
}
