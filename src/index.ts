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
  ChatInputCommandInteraction,
  MessageFlags
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
    .setName("check-permissions")
    .setDescription("Check the bot's permissions in the rules channel")
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
      console.log("No DISCORD_GUILD_ID provided. Skipping command registration.");
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
    console.log(`Starting setupRuleReactions with DISCORD_GUILD_ID=${DISCORD_GUILD_ID}, RULES_CHANNEL_ID=${RULES_CHANNEL_ID}, RULES_MESSAGE_ID=${RULES_MESSAGE_ID}`);
    
    const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
    if (!guild) {
      console.log(`Guild with ID ${DISCORD_GUILD_ID} not found`);
      return;
    }
    console.log(`Found guild: ${guild.name} (${guild.id})`);
    
    try {
      const rulesChannel = guild.channels.cache.get(RULES_CHANNEL_ID) as TextChannel;
      if (!rulesChannel) {
        console.log(`Rules channel with ID ${RULES_CHANNEL_ID} not found in guild ${guild.name}`);
        return;
      }
      console.log(`Found rules channel: ${rulesChannel.name} (${rulesChannel.id})`);
      
      try {
        console.log(`Attempting to fetch message with ID ${RULES_MESSAGE_ID} from channel ${rulesChannel.name}`);
        const rulesMessage = await rulesChannel.messages.fetch(RULES_MESSAGE_ID);
        if (!rulesMessage) {
          console.log(`Rules message with ID ${RULES_MESSAGE_ID} not found in channel ${rulesChannel.name}`);
          return;
        }
        console.log(`Found rules message with content: ${rulesMessage.content.substring(0, 50)}...`);
        
        // Add the reaction to the message if it doesn't already have it
        const reactions = rulesMessage.reactions.cache;
        if (!reactions.has(AGREE_EMOJI)) {
          console.log(`Adding ${AGREE_EMOJI} reaction to rules message`);
          await rulesMessage.react(AGREE_EMOJI);
          console.log(`Successfully added reaction to rules message`);
        } else {
          console.log(`Reaction ${AGREE_EMOJI} already exists on rules message`);
        }
        
        console.log('Rules message reaction collector set up successfully');
      } catch (messageError) {
        console.error(`Error fetching or reacting to rules message: ${messageError}`);
        console.log('This may be due to missing "Read Message History" permission or the message no longer exists');
      }
    } catch (channelError) {
      console.error(`Error accessing rules channel: ${channelError}`);
      console.log('This may be due to missing "View Channel" permission');
    }
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
                { name: '💬 Chat', value: `Visit <#1235699795902070915> to introduce yourself and join the conversation!` },
                { name: '📢 Stay Updated', value: `Check <#1339329788451749979> for important server updates` },
                { name: '❓ FAQ', value: `Browse <#1339329575448084490> for answers to frequently asked questions` },
                { name: '📖 Directory', value: `Find all our channels in <#1341455800199024773>` }
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
    else if (commandName === "use-existing-rules") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ 
          content: "You don't have permission to use this command.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await command.deferReply({ flags: MessageFlags.Ephemeral });
      
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
        return command.reply({ 
          content: "You don't have permission to use this command.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await command.deferReply({ flags: MessageFlags.Ephemeral });
      
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
    else if (commandName === "check-permissions") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ 
          content: "You don't have permission to use this command.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await command.deferReply({ flags: MessageFlags.Ephemeral });
      
      try {
        if (!command.guild || command.guild.id !== DISCORD_GUILD_ID) {
          return command.editReply({ content: "This command must be used in the configured guild." });
        }
        
        // Check for rules channel
        if (!RULES_CHANNEL_ID) {
          return command.editReply({ content: "RULES_CHANNEL_ID is not configured. Please set up rules using /use-existing-rules first." });
        }
        
        const rulesChannel = command.guild.channels.cache.get(RULES_CHANNEL_ID);
        if (!rulesChannel) {
          return command.editReply({ content: `Rules channel with ID ${RULES_CHANNEL_ID} not found in this server. Please check your configuration.` });
        }
        
        // Make sure it's a text channel
        if (rulesChannel.type !== ChannelType.GuildText) {
          return command.editReply({ content: `Channel with ID ${RULES_CHANNEL_ID} is not a text channel. Please use a text channel for rules.` });
        }
        
        const textChannel = rulesChannel as TextChannel;
        
        // Check bot's permissions in the rules channel
        const botMember = command.guild.members.me;
        if (!botMember) {
          return command.editReply({ content: "Could not get the bot's member object. This is unexpected." });
        }
        
        const channelPermissions = textChannel.permissionsFor(botMember);
        if (!channelPermissions) {
          return command.editReply({ content: "Could not get permissions for the bot in the rules channel." });
        }
        
        // Check essential permissions
        const permissionChecks = [
          { name: "View Channel", has: channelPermissions.has(PermissionsBitField.Flags.ViewChannel) },
          { name: "Send Messages", has: channelPermissions.has(PermissionsBitField.Flags.SendMessages) },
          { name: "Read Message History", has: channelPermissions.has(PermissionsBitField.Flags.ReadMessageHistory) },
          { name: "Add Reactions", has: channelPermissions.has(PermissionsBitField.Flags.AddReactions) },
          { name: "Manage Roles", has: channelPermissions.has(PermissionsBitField.Flags.ManageRoles) },
        ];
        
        const missingPermissions = permissionChecks.filter(p => !p.has).map(p => p.name);
        
        if (missingPermissions.length > 0) {
          return command.editReply({ 
            content: `⚠️ The bot is missing the following permissions in the rules channel:
- ${missingPermissions.join("\n- ")}

Please add these permissions to fix issues with the rules reaction system.`
          });
        } else {
          // If we can check the message too, do it
          if (RULES_MESSAGE_ID) {
            try {
              await textChannel.messages.fetch(RULES_MESSAGE_ID);
              return command.editReply({ 
                content: `✅ The bot has all required permissions in the rules channel and can access the rules message.
                
The rule reaction system should work properly now. If you still have issues, please check the role hierarchy in Server Settings > Roles.`
              });
            } catch (error) {
              return command.editReply({ 
                content: `⚠️ The bot has all required permissions in the rules channel, but cannot access the rules message.
                
This might be because:
- The message ID is incorrect
- The message has been deleted
- There's an unexpected API error

Error details: ${error}`
              });
            }
          } else {
            return command.editReply({ 
              content: `✅ The bot has all required permissions in the rules channel.
              
The rule reaction system should work properly after setting up a rules message.`
            });
          }
        }
      } catch (error) {
        console.error('Error in check-permissions command:', error);
        return command.editReply({ content: 'An unexpected error occurred while checking permissions.' });
      }
    }
    else if (commandName === "setup-roles") {
      if (!command.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
        return command.reply({ 
          content: "You don't have permission to use this command.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await command.deferReply({ flags: MessageFlags.Ephemeral });
      
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
        return command.reply({ 
          content: "You don't have permission to use this command.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await command.deferReply({ flags: MessageFlags.Ephemeral });
      
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
      await command.deferReply({ flags: MessageFlags.Ephemeral });
      
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
        return command.reply({ 
          content: "You don't have permission to use this command.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await command.reply({ 
        content: `Onboarding is currently ${ONBOARDING_ENABLED ? 'ENABLED' : 'DISABLED'}.

To ${ONBOARDING_ENABLED ? 'disable' : 'enable'} onboarding, update your environment variable:
\`\`\`
ONBOARDING_ENABLED=${ONBOARDING_ENABLED ? 'false' : 'true'}
\`\`\`

After updating this value, restart the bot for changes to take effect.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
  
  // Handle button clicks
  if (interaction.isButton()) {
    if (interaction.customId === 'view_rules') {
      if (!RULES_CHANNEL_ID) {
        return interaction.reply({ 
          content: "The server has not set up rules yet.", 
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await interaction.reply({
        content: `Please visit <#${RULES_CHANNEL_ID}> to read our rules. React with ✅ on the rules message to gain access to the rest of the server.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
});
