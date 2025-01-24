import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN || "");

// Register slash commands when the bot is ready
client.once("ready", async () => {
  try {
    console.log("Refreshing application commands...");
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!clientId || !guildId) {
      throw new Error("Missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID in .env file.");
    }

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("Slash commands registered successfully!");
    console.log(`Logged in as ${client.user?.tag}`);
  } catch (error) {
    console.error("Error registering commands:", error);
  }
});

// Listen for interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ping") {
    await interaction.reply("Pong!");
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
});
