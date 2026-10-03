import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, escapeMarkdown } from 'discord.js';
import { getRepository, voterHash } from './poll-repository.js';

export function themeMessage(poll) {
  const buttons = ['Aye!', 'Nay!', 'No opinion.'].map((label,i)=>new ButtonBuilder()
    .setCustomId(`theme:${poll.id}:${i}`).setLabel(label).setEmoji(['👍','👎','🖐️'][i])
    .setStyle([ButtonStyle.Primary,ButtonStyle.Danger,ButtonStyle.Secondary][i]));
  return {embeds:[new EmbedBuilder().setColor(0x35363a).setTitle(poll.question)
    .setDescription(`Suggested by ${escapeMarkdown(poll.suggestedBy)} • <t:${Math.floor(Date.parse(poll.createdAt)/1000)}:f>`)
    .setFooter({text:`👍 ${poll.counts[0]}   •   👎 ${poll.counts[1]}   •   🖐 ${poll.counts[2]}   |   ${poll.totalVotes} votes`})],
    components:[new ActionRowBuilder().addComponents(...buttons)],allowedMentions:{parse:[]}};
}

function snapshot(repo,poll,type,voter='',answer='') {
  repo.queueSheetEvent(type,{id:poll.id,theme:poll.question,suggestedBy:poll.suggestedBy,guildId:poll.guildId,
    suggestedAt:poll.createdAt,sourceChannelId:poll.sourceChannelId,channelId:poll.channelId,messageId:poll.messageId,
    aye:poll.counts[0],nay:poll.counts[1],noOpinion:poll.counts[2],totalVotes:poll.totalVotes,voterHash:voter,answer});
}

export async function submitTheme(interaction,config,repository=getRepository) {
  if (!interaction.inGuild()) return interaction.reply({content:'Use /vote in a server text channel.',flags:64});
  if (!config.voteChannelId) return interaction.reply({content:'The organiser needs to set VOTE_CHANNEL_ID in the bot environment first.',flags:64});
  const theme=interaction.options.getString('theme',true).trim();
  if (!theme || theme.length>200) throw new Error('Write a theme between 1 and 200 characters.');
  await interaction.deferReply({flags:64});
  const channel=await interaction.client.channels.fetch(config.voteChannelId);
  if (!channel?.isSendable() || channel.guildId!==interaction.guildId) throw new Error('VOTE_CHANNEL_ID must point to a text channel in this server.');
  const sendPermission=channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  if (!channel.permissionsFor(interaction.client.user)?.has([PermissionFlagsBits.ViewChannel,sendPermission,PermissionFlagsBits.EmbedLinks])) throw new Error('The bot needs View Channel, Send Messages and Embed Links in the voting channel.');
  const repo=repository();
  let poll=repo.create({kind:'theme',question:theme,choices:['Aye!','Nay!','No opinion.'],allowText:false,
    suggestedBy:interaction.member?.displayName || interaction.user.globalName || interaction.user.username,
    createdBy:interaction.user.id,guildId:interaction.guildId,sourceChannelId:interaction.channelId,channelId:channel.id});
  const message=await channel.send(themeMessage(poll));
  poll=repo.update(poll.id,{messageId:message.id});
  snapshot(repo,poll,'theme.submitted');
  await interaction.editReply({content:`Your theme is ready for voting: ${message.url}`,allowedMentions:{parse:[]}});
}

const updating=new Map();
export async function handleThemeVote(interaction,repository=getRepository) {
  const [,id,rawChoice]=interaction.customId.split(':');
  const repo=repository();
  const poll=repo.get(id);
  if (poll.kind!=='theme' || poll.guildId!==interaction.guildId || poll.channelId!==interaction.channelId || poll.messageId!==interaction.message.id) throw new Error('Use the original theme message to vote.');
  const choice=Number(rawChoice);
  if (!/^[012]$/.test(rawChoice)) throw new Error('Choose Aye, Nay or No opinion.');
  await interaction.deferReply({flags:64});
  const voted=repo.vote(id,interaction.user.id,choice);
  snapshot(repo,voted,'theme.voted',voterHash(id,interaction.user.id),voted.choices[choice]);
  // Serialize message edits so concurrent votes cannot leave old totals visible.
  const refresh=(updating.get(id) || Promise.resolve()).catch(()=>{}).then(()=>interaction.message.edit(themeMessage(repo.get(id))));
  updating.set(id,refresh);
  try { await refresh; }
  catch { /* The vote is already durable even if Discord cannot edit the message. */ }
  finally { if (updating.get(id)===refresh) updating.delete(id); }
  return interaction.editReply(`Saved: ${voted.choices[choice]} You can change your vote with another button.`);
}
