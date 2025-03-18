# Botropolis - Discord Onboarding Bot

A Discord bot designed to streamline the onboarding process for new server members. The bot sends welcome messages, guides users through rules acceptance, and grants roles automatically once users agree to the rules.

## Features

- Welcome new members with personalized DMs
- Guide users to read and accept server rules
- Automatically assign roles upon rule acceptance
- Provide a guided tour of important channels
- Configurable through environment variables
- Testing commands for administrators

## Setup Guide

### Prerequisites

- Node.js 16.x or higher
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Discord server with proper permissions

### Installation

1. Clone the repository
2. Install dependencies with `npm install`
3. Configure environment variables (see below)
4. Build with `npm run build`
5. Start with `npm run prod`

### Environment Variables

Configure the following environment variables in your `.env` file or deployment platform:

#### Required Variables

- `DISCORD_BOT_TOKEN` - Your Discord bot token
- `DISCORD_CLIENT_ID` - Your Discord application client ID
- `DISCORD_GUILD_ID` - Your Discord server ID

#### Setup through Commands

These variables can be set up through bot commands:

- `RULES_CHANNEL_ID` - ID of the channel containing rules (set with `/setup-rules` or `/use-existing-rules`)
- `RULES_MESSAGE_ID` - ID of the message that users react to (set with `/setup-rules` or `/use-existing-rules`)
- `MEMBER_ROLE_ID` - ID of the role to assign to users who accept rules (set with `/setup-roles`)
- `WELCOME_CHANNEL_ID` - (Optional) ID of the channel to send public welcome messages (set with `/setup-welcome`)

#### Guided Tour Channels

Configure these to include channel mentions in the guided tour message:

- `GENERAL_CHANNEL_ID` - ID of your main chat channel
- `ANNOUNCEMENTS_CHANNEL_ID` - ID of your announcements channel
- `HELP_CHANNEL_ID` - ID of your help/support channel

#### Feature Flags

- `ONBOARDING_ENABLED` - Set to "true" to enable automatic onboarding for new members (default: false)

### Bot Commands

- `/setup-rules` - Create a rules message in a specific channel
- `/use-existing-rules` - Use an existing message for rules verification
- `/setup-roles` - Specify which role to assign to users who accept rules
- `/setup-welcome` - Set a channel for welcome messages
- `/join` - Test the onboarding flow (admin only)
- `/test-role` - Test role assignment functionality (admin only)
- `/check-permissions` - Check if the bot has necessary permissions
- `/toggle-onboarding` - Display current onboarding status

## Deployment

### Railway

To deploy on Railway:

1. Create a new project and connect your repository
2. Add all required environment variables
3. Deploy the application

### Local

1. Create a `.env` file with all required environment variables
2. Run `npm run dev` for development mode
3. Run `npm run prod` for production mode

## Troubleshooting

- **Missing Permissions**: Make sure the bot has "Read Messages", "Send Messages", "Read Message History", "Add Reactions", and "Manage Roles" permissions
- **Role Hierarchy**: Ensure the bot's role is positioned above any roles it needs to assign in Server Settings → Roles
- **Command Issues**: Use `/check-permissions` to diagnose permission problems