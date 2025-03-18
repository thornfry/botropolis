import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  Events, 
  TextChannel, 
  GuildMember, 
  ChannelType,
  DMChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageReaction,
  User,
  PermissionsBitField,
  Guild,
  Message,
  ChatInputCommandInteraction
} from "discord.js";
import dotenv from "dotenv";

dotenv.config();

// Configure the client with additional intents needed for member events and reaction handling
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ] 
});

// Configuration constants from environment variables
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID || '';
const MEMBER_ROLE_ID = process.env.MEMBER_ROLE_ID || '';
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID || '';
const RULES_MESSAGE_ID = process.env.RULES_MESSAGE_ID || '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';
const AGREE_EMOJI = '✅';

// Feature flags
const ONBOARDING_ENABLED = process.env.ONBOARDING_ENABLED === 'true';

// Define commands
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  new SlashCommandBuilder()
    .setName("setup-rules")
    .setDescription("Sets up the rules message with reaction for verification")
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel to post rules in')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("use-existing-rules")
    .setDescription("Use an existing message for rules verification")
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('The channel containing the rules message')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message_id')
        .setDescription('The ID of the rules message')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("test-role")
    .setDescription("Test role assignment functionality")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Configure the member role for users who agree to rules")
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to assign to verified members')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("setup-welcome")
    .setDescription("Configure the welcome channel for new members")
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to post welcome messages in')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Test command to simulate a member joining the server")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  new SlashCommandBuilder()
    .setName("toggle-onboarding")
    .setDescription("Displays the current onboarding status and instructions to change it")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN || "");

// Register slash commands when the bot is ready
client.once("ready", async () => {
  try {
    console.log("Bot is starting up...");
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = DISCORD_GUILD_ID;

    if (!clientId) {
      throw new Error("Missing DISCORD_CLIENT_ID in .env file.");
    }

    console.log("Refreshing application commands...");
    
    // Delete global commands to prevent duplicates
    try {
      console.log("Removing any existing global commands...");
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: [] }
      );
      console.log("Global commands cleared");
    } catch (error) {
      console.error("Error clearing global commands:", error);
    }
    
    // Register commands to the specific guild
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`Slash commands registered for guild ${guildId}`);
    } else {
      console.warn("No DISCORD_GUILD_ID provided. Skipping command registration.");
    }
    
    console.log(`Logged in as ${client.user?.tag}`);
    
    // Set up rule message reaction listeners if we have a rules message ID
    if (RULES_MESSAGE_ID && RULES_CHANNEL_ID) {
      await setupRuleReactions();
    }
    
    // Log the current configuration
    console.log(`Current configuration:
DISCORD_GUILD_ID: ${DISCORD_GUILD_ID || 'Not set'}
RULES_CHANNEL_ID: ${RULES_CHANNEL_ID || 'Not set'}
MEMBER_ROLE_ID: ${MEMBER_ROLE_ID || 'Not set'}
WELCOME_CHANNEL_ID: ${WELCOME_CHANNEL_ID || 'Not set'}
RULES_MESSAGE_ID: ${RULES_MESSAGE_ID || 'Not set'}
ONBOARDING_ENABLED: ${ONBOARDING_ENABLED ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error("Error during startup:", error);
  }
});

// Function to set up reaction collectors for the rules message
async function setupRuleReactions() {
  try {
    const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
    if (!guild) {
      console.warn(`Guild with ID ${DISCORD_GUILD_ID} not found`);
      return;
    }
    
    const rulesChannel = guild.channels.cache.get(RULES_CHANNEL_ID) as TextChannel;
    if (!rulesChannel) {
      console.warn(`Rules channel with ID ${RULES_CHANNEL_ID} not found`);
      return;
    }
    
    const rulesMessage = await rulesChannel.messages.fetch(RULES_MESSAGE_ID);
    if (!rulesMessage) {
      console.warn(`Rules message with ID ${RULES_MESSAGE_ID} not found`);
      return;
    }
    
    // Add the reaction to the message if it doesn't already have it
    const reactions = rulesMessage.reactions.cache;
    if (!reactions.has(AGREE_EMOJI)) {
      await rulesMessage.react(AGREE_EMOJI);
    }
    
    console.log('Rules message reaction collector set up successfully');
  } catch (error) {
    console.error('Error setting up rules message reactions:', error);
  }
}

// Handle new member joins
client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  try {
    // Only process for the configured guild
    if (member.guild.id !== DISCORD_GUILD_ID) return;
    
    console.log(`New member joined: ${member.user.tag}`);
    
    // Only send welcome DM if onboarding is enabled
    if (ONBOARDING_ENABLED) {
      console.log(`Onboarding enabled - sending welcome DM to ${member.user.tag}`);
      await sendWelcomeDM(member);
      
      // If there's a welcome channel, send a public welcome
      if (WELCOME_CHANNEL_ID) {
        const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID) as TextChannel;
        if (welcomeChannel) {
          welcomeChannel.send(`Welcome to the server, ${member}! Please check your DMs for information on getting started.`);
        }
      }
    } else {
      console.log(`Onboarding disabled - skipping welcome DM for ${member.user.tag}`);
    }
  } catch (error) {
    console.error(`Error handling new member ${member.user.tag}:`, error);
  }
});

// Send welcome DM to new members
async function sendWelcomeDM(member: GuildMember) {
  try {
    const dm = await member.createDM();
    
    // Only proceed with welcome flow if server has rules channel set up
    if (!RULES_CHANNEL_ID) {
      return;
    }
    
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle(`Welcome to ${member.guild.name}!`)
      .setDescription('We\'re excited to have you join our community!')
      .addFields(
        { name: 'Getting Started', value: 'To access the server, you need to read and agree to our rules.' }
      )
      .setFooter({ text: 'Botropolis - Onboarding Bot' });
    
    const rulesButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('view_rules')
          .setLabel('View Server Rules')
          .setStyle(ButtonStyle.Primary)
      );
    
    await dm.send({ embeds: [welcomeEmbed], components: [rulesButton] });
    console.log(`Sent welcome DM to ${member.user.tag}`);
  } catch (error) {
    console.error(`Error sending welcome DM to ${member.user.tag}:`, error);
  }
}

// Handle messageReactionAdd event for rule acceptance
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  // Ignore bot reactions
  if (user.bot) return;
  
  try {
    console.log(`Reaction detected: ${reaction.emoji.name} by ${user.tag}`);
    
    // Check if this is the rules message and the correct emoji
    if (reaction.message.id === RULES_MESSAGE_ID && reaction.emoji.name === AGREE_EMOJI) {
      console.log(`Correct message (${RULES_MESSAGE_ID}) and emoji (${AGREE_EMOJI}) detected`);
      
      const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
      if (!guild) {
        console.error(`Guild not found with ID: ${DISCORD_GUILD_ID}`);
        return;
      }
      
      const member = guild.members.cache.get(user.id);
      if (!member) {
        console.error(`Member not found in guild with ID: ${user.id}`);
        return;
      }
      
      // Assign the member role
      if (MEMBER_ROLE_ID) {
        console.log(`Attempting to assign role ${MEMBER_ROLE_ID} to ${user.tag}`);
        try {
          await member.roles.add(MEMBER_ROLE_ID);
          console.log(`Successfully assigned member role to ${user.tag}`);
          
          // Send follow-up DM with guided tour information
          try {
            const dm = await member.createDM();
            
            const tourEmbed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle(`Welcome to ${guild.name}!`)
              .setDescription('You now have access to the server! Here\'s a quick guide to help you get started:')
              .addFields(
                { name: '💬 General Chat', value: 'Introduce yourself and join the conversation!' },
                { name: '📢 Announcements', value: 'Check here for important server updates' },
                { name: '🤝 Help Channel', value: 'If you have any questions, ask here' }
              )
              .setFooter({ text: 'We hope you enjoy your time here!' });
            
            await dm.send({ embeds: [tourEmbed] });
            console.log(`Sent tour DM to ${user.tag}`);
          } catch (dmError) {
            console.error(`Error sending tour DM to ${user.tag}:`, dmError);
          }
        } catch (roleError) {
          console.error(`Error assigning role ${MEMBER_ROLE_ID} to ${user.tag}:`, roleError);
        }
      } else {
        console.error('MEMBER_ROLE_ID is not configured');
      }
    } else {
      console.log(`Incorrect message or emoji. Expected message ID: ${RULES_MESSAGE_ID}, emoji: ${AGREE_EMOJI}, got: ${reaction.message.id}, ${reaction.emoji.name}`);
    }
  } catch (error) {
    console.error('Error handling reaction:', error);
  }
});

// Handle button interactions and commands
client.on(Events.InteractionCreate, async (interaction) => {
  // Handle slash commands
  if (interaction.isCommand()) {
    const command = interaction as ChatInputCommandInteraction;
    const { commandName } = command;

    if (commandName === "ping") {
      await command.reply("Pong!");
    } 
    else if (commandName === "setup-rules") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      await command.deferReply({ ephemeral: true });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        const channel = command.options.getChannel('channel') as TextChannel;
        if (!channel || channel.type !== ChannelType.GuildText) {
          return command.editReply({ content: "You must select a text channel for the rules message." });
        }
        
        // Create and send rules message
        const rulesEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Server Rules')
          .setDescription('Please read our server rules carefully and react with ✅ to agree and gain access to the server.')
          .addFields(
            { name: 'Rule 1', value: 'Be respectful to all members' },
            { name: 'Rule 2', value: 'No spam or self-promotion' },
            { name: 'Rule 3', value: 'Follow Discord\'s Terms of Service' }
          )
          .setFooter({ text: 'React with ✅ to agree to these rules' });
        
        const ruleMessage = await channel.send({ embeds: [rulesEmbed] });
        await ruleMessage.react(AGREE_EMOJI);
        
        // Return detailed information for setting environment variables
        command.editReply({ 
          content: `Rules message set up in ${channel}. Please update your environment variables with:
\`\`\`
RULES_CHANNEL_ID=${channel.id}
RULES_MESSAGE_ID=${ruleMessage.id}
\`\`\`

After updating these values, restart the bot for changes to take effect.`
        });
      } catch (error) {
        console.error('Error setting up rules message:', error);
        command.editReply({ content: 'There was an error setting up the rules message. Check the console for details.' });
      }
    }
    else if (commandName === "use-existing-rules") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      await command.deferReply({ ephemeral: true });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        const channel = command.options.getChannel('channel') as TextChannel;
        if (!channel || channel.type !== ChannelType.GuildText) {
          return command.editReply({ content: "You must select a text channel." });
        }
        
        const messageId = command.options.getString('message_id');
        if (!messageId) {
          return command.editReply({ content: "Please provide a valid message ID." });
        }
        
        try {
          // Try to fetch the message to verify it exists
          const message = await channel.messages.fetch(messageId);
          
          // Add reaction to the message
          await message.react(AGREE_EMOJI);
          
          // Return detailed information for setting environment variables
          command.editReply({ 
            content: `Using existing message for rules. Please update your environment variables with:
\`\`\`
RULES_CHANNEL_ID=${channel.id}
RULES_MESSAGE_ID=${messageId}
\`\`\`

After updating these values, restart the bot for changes to take effect.`
          });
        } catch (fetchError) {
          return command.editReply({ content: `Error: Could not find a message with ID ${messageId} in the selected channel. Make sure you have the correct message ID and the message is in the selected channel.` });
        }
      } catch (error) {
        console.error('Error setting up existing rules message:', error);
        command.editReply({ content: 'There was an error setting up the rules message. Check the console for details.' });
      }
    }
    else if (commandName === "test-role") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      await command.deferReply({ ephemeral: true });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        if (!MEMBER_ROLE_ID) {
          return command.editReply({ content: "MEMBER_ROLE_ID is not configured. Please set up a role using /setup-roles first." });
        }
        
        const member = command.member as GuildMember;
        
        try {
          // Check if the role exists
          const role = command.guild.roles.cache.get(MEMBER_ROLE_ID);
          if (!role) {
            return command.editReply({ content: `Role with ID ${MEMBER_ROLE_ID} not found in this server. Please check your configuration.` });
          }
          
          // Get the bot's role
          const botMember = command.guild.members.cache.get(client.user!.id);
          if (!botMember) {
            return command.editReply({ content: "Could not find the bot in this server. This is an unexpected error." });
          }
          
          // Check role hierarchy
          const botHighestRole = botMember.roles.highest;
          if (botHighestRole.position <= role.position) {
            return command.editReply({ 
              content: `⚠️ Role hierarchy issue: The bot's highest role (${botHighestRole.name}) is positioned at or below the role it's trying to assign (${role.name}). Please move the bot's role above the member role in Server Settings > Roles.`
            });
          }
          
          // Try to assign the role
          await member.roles.add(MEMBER_ROLE_ID);
          
          return command.editReply({ 
            content: `✅ Successfully assigned the role ${role.name} to you! The role assignment system is working correctly.`
          });
        } catch (error) {
          console.error('Error in test-role command:', error);
          return command.editReply({ 
            content: `❌ Error assigning role: ${error}\n\nPossible issues:\n- The bot doesn't have the "Manage Roles" permission\n- The role hierarchy is incorrect (bot's role must be above the role it tries to assign)\n- The role ID is invalid`
          });
        }
      } catch (error) {
        console.error('Error in test-role command:', error);
        return command.editReply({ content: 'An unexpected error occurred during role testing.' });
      }
    }
    else if (commandName === "setup-roles") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      await command.deferReply({ ephemeral: true });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        const role = command.options.getRole('role');
        if (!role) {
          return command.editReply({ content: "Please select a valid role." });
        }
        
        // Return info for updating env var
        command.editReply({
          content: `Please update your environment variable with:
\`\`\`
MEMBER_ROLE_ID=${role.id}
\`\`\`

After updating this value, restart the bot for changes to take effect.`
        });
      } catch (error) {
        console.error('Error setting up member role:', error);
        command.editReply({ content: 'There was an error processing the member role. Check the console for details.' });
      }
    }
    else if (commandName === "setup-welcome") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      await command.deferReply({ ephemeral: true });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        const channel = command.options.getChannel('channel') as TextChannel;
        if (!channel || channel.type !== ChannelType.GuildText) {
          return command.editReply({ content: "You must select a text channel for welcome messages." });
        }
        
        // Return info for updating env var
        command.editReply({
          content: `Please update your environment variable with:
\`\`\`
WELCOME_CHANNEL_ID=${channel.id}
\`\`\`

After updating this value, restart the bot for changes to take effect.`
        });
      } catch (error) {
        console.error('Error setting up welcome channel:', error);
        command.editReply({ content: 'There was an error processing the welcome channel. Check the console for details.' });
      }
    }
    else if (commandName === "join") {
      await command.deferReply({ ephemeral: true });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        const member = command.member as GuildMember;
        
        // Simulate the member joining
        console.log(`Simulating join for: ${member.user.tag}`);
        
        // Call the same welcome function used for actual joins
        await sendWelcomeDM(member);
        
        // If there's a welcome channel, send a welcome message there too
        if (WELCOME_CHANNEL_ID) {
          const welcomeChannel = command.guild.channels.cache.get(WELCOME_CHANNEL_ID) as TextChannel;
          if (welcomeChannel) {
            welcomeChannel.send(`Welcome to the server, ${member}! Please check your DMs for information on getting started.`);
          }
        }
        
        return command.editReply({ content: "Join simulation completed! Check your DMs for the welcome message." });
      } catch (error) {
        console.error('Error simulating join:', error);
        return command.editReply({ content: `Error simulating join: ${error}` });
      }
    }
    else if (commandName === "toggle-onboarding") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ content: "You don't have permission to use this command.", ephemeral: true });
      }
      
      await command.reply({ 
        content: `Onboarding is currently ${ONBOARDING_ENABLED ? 'ENABLED' : 'DISABLED'}.

To ${ONBOARDING_ENABLED ? 'disable' : 'enable'} onboarding, update your environment variable:
\`\`\`
ONBOARDING_ENABLED=${ONBOARDING_ENABLED ? 'false' : 'true'}
\`\`\`

After updating this value, restart the bot for changes to take effect.`,
        ephemeral: true 
      });
    }
  }
  
  // Handle button clicks
  if (interaction.isButton()) {
    if (interaction.customId === 'view_rules') {
      if (!RULES_CHANNEL_ID) {
        return interaction.reply({ content: "The server has not set up rules yet.", ephemeral: true });
      }
      
      await interaction.reply({
        content: `Please visit <#${RULES_CHANNEL_ID}> to read our rules. React with ✅ on the rules message to gain access to the rest of the server.`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
});
