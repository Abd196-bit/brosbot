import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../src/poll-repository.js';
import { submitTheme,handleThemeVote } from '../src/theme-vote.js';
import { commandData } from '../src/commands.js';

test('/vote is open to members with a required theme',()=>{
  const command=commandData.find(c=>c.name==='vote');
  assert.equal(command.default_member_permissions,undefined);
  assert.equal(command.options[0].name,'theme');
  assert.equal(command.options[0].required,true);
});

test('theme goes to configured channel, changeable votes and sheet events persist',async()=>{
  const repo=createRepository(':memory:');
  try {
    let posted,reply;
    const channel={id:'destination',guildId:'guild',isSendable:()=>true,isThread:()=>false,permissionsFor:()=>({has:()=>true}),send:async p=>{posted=p;return {id:'message',url:'https://discord.com/channels/guild/destination/message'};}};
    const common={guildId:'guild',channelId:'source',user:{id:'member',username:'Member'},inGuild:()=>true,options:{getString:()=> 'Switch it up'},client:{user:{id:'bot'},channels:{fetch:async()=>channel}},deferReply:async()=>{},editReply:async p=>{reply=p;}};
    await submitTheme(common,{voteChannelId:'destination'},()=>repo);
    assert.match(reply.content,/destination/);
    const poll=repo.list()[0];
    assert.equal(poll.sourceChannelId,'source');
    assert.equal(posted.embeds[0].toJSON().title,'Switch it up');
    const interaction={...common,channelId:'destination',message:{id:'message',edit:async p=>{posted=p;}}};
    await handleThemeVote({...interaction,customId:`theme:${poll.id}:0`},()=>repo);
    await handleThemeVote({...interaction,customId:`theme:${poll.id}:1`},()=>repo);
    assert.deepEqual(repo.get(poll.id).counts,[0,1,0]);
    assert.equal(repo.pendingSheetEvents(25,'theme').length,3);
    assert.equal(repo.pendingSheetEvents(25,'poll').length,0);
    await assert.rejects(handleThemeVote({...interaction,channelId:'wrong',customId:`theme:${poll.id}:0`},()=>repo),/original/);
  } finally {repo.close();}
});
