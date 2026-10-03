import { REST, Routes } from 'discord.js';
import { getConfig } from './config.js';
import { commandData } from './commands.js';

const config = getConfig();
const rest = new REST({ version: '10' }).setToken(config.token);
const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

await rest.put(route, { body: commandData });
console.log(`Deployed ${commandData.length} ${config.guildId ? 'guild' : 'global'} command(s).`);
