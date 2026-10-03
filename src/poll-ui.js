import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, MessageFlags, escapeMarkdown } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { getRepository, voterHash } from './poll-repository.js';

const drafts = new Map();
const pending = new Set();
const privateFlags = MessageFlags.Ephemeral;
const row = (...items) => new ActionRowBuilder().addComponents(...items);
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const closed = p => p.closed || Boolean(p.closesAt && Date.parse(p.closesAt) <= Date.now());
const safe = s => escapeMarkdown(s);
const emojiPalette = ['🎮','🕹️','🏆','⭐','🔥','❤️','👍','👎','✅','❌','🎨','🎵','🧩','🚀','👻','⚔️','🌟','🐱','🍕','💡'];

function field(id, label, value = '', required = false, max = 80, paragraph = false) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(required).setMaxLength(max);
  if (value) input.setValue(value);
  return row(input);
}

export function editorModal(draft, section = 'main') {
  const modal = new ModalBuilder().setCustomId(`edit:${draft.id}:${section}`).setTitle(section === 'main' ? 'Create your poll' : section === 'media' ? 'Images, links & timing' : 'Edit answer options');
  if (section === 'main') modal.addComponents(field('question', 'Poll question', draft.question, true, 200), ...Array.from({length:4}, (_, i) => field(`answer${i}`, `Answer ${i + 1}${i < 2 ? '' : ' (optional)'}`, draft.choices[i], i < 2)));
  else if (section === 'media') modal.addComponents(field('description','Description',draft.description,false,1000,true),field('image','Picture URL (https://...)',draft.image,false,500),field('link','Link URL (https://...)',draft.link,false,500),field('linkLabel','Link button label',draft.linkLabel,false,60),field('minutes','Close after minutes (blank = no deadline)',draft.minutes,false,5));
  else {
    const start = section === 'answers1' ? 0 : 5;
    modal.addComponents(...Array.from({length:5},(_,i)=>field(`answer${i+start}`,`Answer ${i+start+1}${i+start < 2 ? '' : ' (optional)'}`,draft.choices[i+start],i+start < 2)));
  }
  return modal;
}

export function validateDraft(draft) {
  if (!draft.question?.trim()) throw new Error('Add a question.');
  const choices = draft.choices.filter(Boolean);
  if (choices.length < 2 || choices.length > 10) throw new Error('Add between 2 and 10 answers.');
  if (new Set(choices.map(v=>v.toLowerCase())).size !== choices.length) throw new Error('Each answer must be different. Edit the duplicate answers.');
  for (const name of ['image','link']) if (draft[name]) {
    let url; try { url = new URL(draft[name]); } catch { throw new Error(`The ${name} must be a valid HTTPS URL.`); }
    if (url.protocol !== 'https:') throw new Error(`Use an HTTPS URL for the ${name}.`);
  }
  if (draft.minutes && (!/^\d+$/.test(draft.minutes) || +draft.minutes < 1 || +draft.minutes > 10080)) throw new Error('Duration must be 1–10080 minutes, or left blank.');
  return { ...draft, choices, emojis: draft.choices.flatMap((choice,i)=>choice ? [draft.emojis?.[i] || ''] : []) };
}

export function pollMessage(poll, preview = false) {
  const choices = poll.choices.filter(Boolean);
  const emojis = poll.choices.flatMap((choice,i)=>choice ? [poll.emojis?.[i] || ''] : []);
  const count = poll.totalVotes || 0;
  const embed = new EmbedBuilder().setColor(preview ? 0x9b87f5 : closed(poll) ? 0x747f8d : 0x5865f2).setAuthor({name:preview ? 'BRO’S JAM • PRIVATE PREVIEW' : 'BRO’S JAM • COMMUNITY POLL'}).setTitle(poll.question || 'Your new poll').setDescription(poll.description || 'Choose an answer below. You can change your vote anytime.');
  embed.addFields({name: preview ? 'Answer options' : 'Results',value:choices.map((label,i)=>`${emojis[i] || (i+1)+'.'} **${safe(label)}**${preview ? '' : ` — ${poll.counts?.[i] || 0} votes`}`).join('\n') || 'Add at least two answers.'});
  if (poll.allowText) embed.addFields({name:'Have another idea?',value:'Press ＋ My own idea. Your text stays private to the poll creator and server managers.'});
  if (poll.image) embed.setImage(poll.image);
  if (poll.closesAt) embed.addFields({name:'Voting deadline',value:`<t:${Math.floor(Date.parse(poll.closesAt)/1000)}:R>`});
  embed.setFooter({text: preview ? `Only you can see this • Custom text ${poll.allowText ? 'ON' : 'OFF'} • ${poll.minutes ? poll.minutes + ' minutes' : 'No deadline'}` : `${count} vote${count===1?'':'s'} • ${closed(poll) ? 'Closed' : 'One vote per person'}`});
  const components = [];
  if (!preview) {
    for (let start=0;start<choices.length;start+=5) {
      components.push(row(...choices.slice(start,start+5).map((label,offset)=>{
        const index=start+offset;
        const choice=button(`poll:${poll.id}:${index}`,label,ButtonStyle.Primary).setDisabled(Boolean(closed(poll)));
        if (emojis[index]) choice.setEmoji(emojis[index]);
        return choice;
      })));
    }
    const actions = [];
    if (poll.allowText) actions.push(button(`poll:${poll.id}:text`,'＋ My own idea').setDisabled(Boolean(closed(poll))));
    actions.push(button(`poll:${poll.id}:results`,'View results'),button(`poll:${poll.id}:close`,'Close poll',ButtonStyle.Danger).setDisabled(Boolean(closed(poll))));
    if (poll.link) actions.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(poll.linkLabel || 'Open link').setURL(poll.link));
    if (poll.allowText) actions.push(button(`poll:${poll.id}:ideas`,'Private ideas · organisers'));
    components.push(row(...actions));
  }
  return {embeds:[embed],components,allowedMentions:{parse:[]}};
}

function editorMessage(draft) {
  const payload = pollMessage(draft,true);
  payload.content = '**Your poll is a draft.** Edit it below, then press **Publish poll**.';
  payload.components = [row(button(`draft:${draft.id}:main`,'Question & first answers'),button(`draft:${draft.id}:answers1`,'Answers 1–5'),button(`draft:${draft.id}:answers2`,'Answers 6–10')),row(button(`draft:${draft.id}:media`,'Picture, link & timing'),button(`draft:${draft.id}:text`, `Custom text: ${draft.allowText ? 'ON' : 'OFF'}`,draft.allowText ? ButtonStyle.Success : ButtonStyle.Secondary)),row(button(`draft:${draft.id}:publish`,'Publish poll',ButtonStyle.Success),button(`draft:${draft.id}:cancel`,'Discard',ButtonStyle.Danger))];
  payload.components[1].addComponents(button(`draft:${draft.id}:emojis`,'😀 Answer emojis'));
  if (draft.showEmojis && draft.choices.some(Boolean)) {
    const selected = draft.choices[draft.emojiAnswer] ? draft.emojiAnswer : draft.choices.findIndex(Boolean);
    payload.components.push(row(new StringSelectMenuBuilder().setCustomId(`draft:${draft.id}:emojiAnswer`).setPlaceholder('1. Choose an answer').addOptions(draft.choices.flatMap((label,i)=>label ? [{label:`${i+1}. ${label}`.slice(0,100),value:String(i),default:i===selected}] : []))));
    payload.components.push(row(new StringSelectMenuBuilder().setCustomId(`draft:${draft.id}:emojiPick`).setPlaceholder('2. Choose an emoji').addOptions([{label:'Remove emoji',value:'none'},...emojiPalette.map((emoji,i)=>({label:emoji,value:String(i),emoji:{name:emoji}}))])));
  }
  return payload;
}

export async function startPoll(interaction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({content:'Manage Server permission is required to create polls.',flags:privateFlags});
  for (const [id,d] of drafts) if (Date.now()-d.updatedAt>3_600_000) drafts.delete(id);
  const draft = {id:randomUUID(),createdBy:interaction.user.id,guildId:interaction.guildId,channelId:interaction.channelId,choices:[],question:'',description:'',image:'',link:'',linkLabel:'',minutes:'',allowText:true,updatedAt:Date.now()};
  drafts.set(draft.id,draft);
  return interaction.showModal(editorModal(draft));
}

async function refresh(interaction,poll) {
  if (!poll.messageId) return;
  try { const channel = await interaction.client.channels.fetch(poll.channelId); await channel.messages.edit(poll.messageId,pollMessage(poll)); }
  catch { /* The saved vote remains valid if the original message was deleted. */ }
}

export async function handlePollInteraction(interaction, repository = getRepository) {
  const [kind,id,action] = interaction.customId.split(':');
  if (kind==='draft' || kind==='edit') {
    const draft = drafts.get(id);
    if (!draft || Date.now()-draft.updatedAt > 3_600_000 || draft.createdBy !== interaction.user.id || draft.channelId !== interaction.channelId) return interaction.reply({content:'This editor has expired. Run /poll to open a new one.',flags:privateFlags});
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server permission is required.');
    if (draft.publishing) return interaction.reply({content:'Your poll is being published. Please wait.',flags:privateFlags});
    draft.updatedAt = Date.now();
    if (kind==='draft' && ['emojis','emojiAnswer','emojiPick'].includes(action)) {
      if (action==='emojis') draft.showEmojis=!draft.showEmojis;
      if (action==='emojiAnswer') {
        const selected=Number(interaction.values[0]);
        if (!draft.choices[selected]) throw new Error('Choose an existing answer.');
        draft.emojiAnswer=selected;
      }
      if (action==='emojiPick') {
        const selected=draft.choices[draft.emojiAnswer] ? draft.emojiAnswer : draft.choices.findIndex(Boolean);
        const value=interaction.values[0];
        if (value!=='none' && !emojiPalette[Number(value)]) throw new Error('Choose an emoji from the picker.');
        draft.emojis ??= [];
        draft.emojis[selected]=value==='none' ? '' : emojiPalette[Number(value)];
      }
      return interaction.update(editorMessage(draft));
    }
    if (kind==='edit') {
      const next = {...draft,choices:[...draft.choices]};
      for (const [name,input] of interaction.fields.fields) {
        const value = input.value.trim();
        if (name.startsWith('answer')) next.choices[Number(name.slice(6))]=value;
        else next[name]=value;
      }
      try { validateDraft(next); } catch (error) {
        // Keep the original editor reachable, including after an invalid first form.
        const payload = {...editorMessage(draft),content:error.message+' Use the edit buttons below to correct your draft.'};
        if (interaction.isFromMessage()) return interaction.update(payload);
        return interaction.reply({...payload,flags:privateFlags});
      }
      drafts.set(id,next);
      if (interaction.isFromMessage()) return interaction.update(editorMessage(next));
      return interaction.reply({...editorMessage(next),flags:privateFlags});
    }
    if (['main','answers1','answers2','media'].includes(action)) return interaction.showModal(editorModal(draft,action));
    if (action==='text') {draft.allowText=!draft.allowText; return interaction.update(editorMessage(draft));}
    if (action==='cancel') {drafts.delete(id); return interaction.update({content:'Draft discarded. Run /poll whenever you’re ready.',embeds:[],components:[]});}
    if (action==='publish') {
      const clean = validateDraft(draft);
      draft.publishing = true;
      await interaction.deferUpdate();
      try {
        if (!interaction.channel?.isSendable()) throw new Error('Please create the poll in a server text channel.');
        const permissions = interaction.channel.permissionsFor(interaction.client.user);
        const sendPermission = interaction.channel.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
        if (!permissions?.has([sendPermission,PermissionFlagsBits.ViewChannel,PermissionFlagsBits.EmbedLinks])) throw new Error('Give the bot View Channel, Send Messages, and Embed Links permissions here.');
        const repo = repository();
        let poll = repo.create({...clean,closesAt:clean.minutes ? new Date(Date.now()+Number(clean.minutes)*60000).toISOString():null});
        const message = await interaction.channel.send(pollMessage(poll));
        poll = repo.update(poll.id,{messageId:message.id});
        repo.queueSheetEvent('poll.published', {
          id: poll.id, guildId: poll.guildId, channelId: poll.channelId, messageId: poll.messageId,
          question: poll.question, choices: poll.choices, emojis: poll.emojis, description: poll.description,
          allowText: poll.allowText, closesAt: poll.closesAt, totalVotes: poll.totalVotes,
        });
        drafts.delete(id);
        return interaction.editReply({content:`✅ Your poll is live! [Open poll](${message.url})`,embeds:[],components:[]});
      } catch(error) { draft.publishing=false; await interaction.editReply({...editorMessage(draft),content:`Could not publish: ${error.message}\nYour draft is saved. Fix the issue and try Publish again.`}); }
    }
    return;
  }
  const repo=repository();
  const poll=repo.get(id);
  if (poll.guildId!==interaction.guildId || poll.channelId!==interaction.channelId) throw new Error('Use this poll in its original channel.');
  if (kind==='poll' && action==='text') {
    if (!poll.allowText || closed(poll)) throw new Error('This poll is not accepting written answers.');
    return interaction.showModal(new ModalBuilder().setCustomId(`polltext:${id}`).setTitle('Send a private idea').addComponents(field('response','Idea (only organisers can read it)','',true)));
  }
  await interaction.deferReply({flags:privateFlags});
  if (pending.has(id)) return interaction.editReply('Another vote is updating the poll. Please try again in a moment.');
  pending.add(id);
  try {
    if (kind==='poll' && action==='results') {
      const lines=poll.choices.map((label,i)=>`${safe(label)} — ${poll.counts[i]}`);
      const privateCount=poll.customResponses.reduce((sum,a)=>sum+a.count,0);
      if (privateCount) lines.push(`Private ideas: ${privateCount} (text hidden)`);
      return interaction.editReply({content:`**${poll.totalVotes} votes**\n${lines.join('\n').slice(0,1800)}`,allowedMentions:{parse:[]}});
    }
    if (kind==='poll' && action==='ideas') {
      if (poll.createdBy!==interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Only the poll creator and server managers can read private ideas.');
      const report=poll.customResponses.map(a=>`${a.text} — ${a.count}`).join('\n');
      return interaction.editReply(report ? {content:'Private ideas for organisers only.',files:[{attachment:Buffer.from(report,'utf8'),name:'private-ideas.txt'}]} : 'No private ideas submitted yet.');
    }
    if (kind==='poll' && action==='close') {
      if (poll.createdBy!==interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) throw new Error('Only the poll creator or a server manager can close it.');
      const closedPoll = repo.update(id,{closed:true});
      repo.queueSheetEvent('poll.closed', { id: closedPoll.id, guildId: closedPoll.guildId, channelId: closedPoll.channelId, messageId: closedPoll.messageId, question: closedPoll.question, totalVotes: closedPoll.totalVotes });
      await refresh(interaction,closedPoll);
      return interaction.editReply('Poll closed. The results remain visible.');
    }
    const writtenIdea = kind==='polltext' ? interaction.fields.getTextInputValue('response').trim() : undefined;
    const choiceIndex = kind==='vote' ? Number(interaction.values[0]) : Number(action);
    const voted=repo.vote(id,interaction.user.id,choiceIndex,writtenIdea);
    repo.queueSheetEvent('vote.saved', {
      pollId: id, answerType: writtenIdea === undefined ? 'preset' : 'private idea',
      answer: writtenIdea === undefined ? voted.choices[choiceIndex] : writtenIdea,
      totalVotes: voted.totalVotes, voterHash: voterHash(id,interaction.user.id),
    });
    await refresh(interaction,voted);
    return interaction.editReply({content:kind==='polltext' ? '✅ Your idea is saved privately for the organisers. It will not appear in the poll or public results. It replaces your previous vote.' : '✅ Vote saved. You can change it by choosing another answer.',allowedMentions:{parse:[]}});
  } finally {pending.delete(id);}
}
