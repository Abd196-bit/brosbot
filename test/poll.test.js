import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepository } from '../src/poll-repository.js';
import { editorModal, pollMessage, validateDraft, startPoll, handlePollInteraction } from '../src/poll-ui.js';
import { PermissionFlagsBits } from 'discord.js';
import { flushSheetEvents, pollSheetsConfigured } from '../src/google-sheet-sync.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const draft = {id:'test', question:'What should we build?', choices:['Platformer','Puzzle'], description:'Choose one', allowText:true};
test('votes change, typed answers stay separate, and closed polls reject votes',()=>{
  const repo=createRepository(':memory:');
  try {
    const p=repo.create(draft);
    assert.equal(repo.vote(p.id,'user',0).totalVotes,1);
    assert.deepEqual(repo.vote(p.id,'user',1).counts,[0,1]);
    const custom=repo.vote(p.id,'user',undefined,'Racing');
    assert.deepEqual(custom.choices,draft.choices);
    assert.deepEqual(custom.counts,[0,0]);
    assert.equal(custom.customResponses[0].text,'Racing');
    assert.equal(repo.vote(p.id,'other',0).totalVotes,2);
    repo.update(p.id,{closed:true});
    assert.throws(()=>repo.vote(p.id,'third',0),/closed/);
  } finally {repo.close();}
});
test('expiry and custom-answer toggle are enforced',()=>{
  const repo=createRepository(':memory:');
  try {
    const p=repo.create({...draft,allowText:false});
    assert.throws(()=>repo.vote(p.id,'user',undefined,'hi'),/disabled/);
    repo.update(p.id,{closesAt:new Date(0).toISOString()});
    assert.throws(()=>repo.vote(p.id,'user',0),/closed/);
  } finally {repo.close();}
});
test('separate fields and Discord payload limits validate',()=>{
  for (const section of ['main','answers1','answers2','media']) {
    const json=editorModal(draft,section).toJSON();
    assert.equal(json.components.length,5);
  }
  const payload=pollMessage({...draft,choices:Array.from({length:10},(_,i)=>'Answer '+i), counts:Array(10).fill(0)});
  payload.embeds.forEach(e=>e.toJSON()); payload.components.forEach(c=>c.toJSON());
  assert.throws(()=>validateDraft({...draft,choices:['same','SAME']}),/different/);
  assert.throws(()=>validateDraft({...draft,image:'bad'}),/HTTPS/);
  assert.throws(()=>validateDraft({...draft,minutes:'0'}),/Duration/);
});
test('slash opens private form, submit shows editor and text toggle works',async()=>{
  let modal;
  const common={user:{id:'creator'},guildId:'guild',channelId:'channel',memberPermissions:{has:p=>p===PermissionFlagsBits.ManageGuild}};
  await startPoll({...common,inGuild:()=>true,showModal:async m=>{modal=m.toJSON();}});
  const fields=new Map([['question',{value:'A question'}],['answer0',{value:'First'}],['answer1',{value:'Second'}],['answer2',{value:''}],['answer3',{value:''}]]);
  let editor;
  await handlePollInteraction({...common,customId:modal.custom_id,fields:{fields},isFromMessage:()=>false,reply:async p=>{editor=p;}});
  assert.equal(editor.flags,64);
  const toggle=editor.components[1].toJSON().components[1];
  assert.equal(toggle.label,'Custom text: ON');
  await handlePollInteraction({...common,customId:toggle.custom_id,update:async p=>{editor=p;}});
  assert.equal(editor.components[1].toJSON().components[1].label,'Custom text: OFF');
  await handlePollInteraction({...common,customId:editor.components[1].toJSON().components[2].custom_id,update:async p=>{editor=p;}});
  assert.equal(editor.components.length,5);
  await handlePollInteraction({...common,customId:editor.components[3].toJSON().components[0].custom_id,values:['1'],update:async p=>{editor=p;}});
  await handlePollInteraction({...common,customId:editor.components[4].toJSON().components[0].custom_id,values:['0'],update:async p=>{editor=p;}});
  editor.components.forEach(c=>c.toJSON());
  const repo=createRepository(':memory:');
  let posted;
  let saved;
  let deferred=false;
  const publish=editor.components[2].toJSON().components[0].custom_id;
  try {
    await handlePollInteraction({...common,customId:publish,client:{user:{id:'bot'}},deferUpdate:async()=>{deferred=true;},channel:{isSendable:()=>true,isThread:()=>false,permissionsFor:()=>({has:()=>true}),send:async payload=>{assert.equal(deferred,true);posted=payload;return{id:'message',url:'https://discord.com/channels/guild/channel/message'};}},editReply:async p=>{saved=p;}},()=>repo);
    assert.match(saved.content,/poll is live/);
    assert.equal(posted.components[0].toJSON().components.length,2);
    const pollId=posted.components[0].toJSON().components[0].custom_id.split(':')[1];
    assert.equal(repo.get(pollId).messageId,'message');
    assert.equal(repo.get(pollId).emojis[1],'🎮');
    assert.equal(posted.components[0].toJSON().components[1].emoji.name,'🎮');
  } finally {repo.close();}
});
test('polls and votes survive reopening storage',()=>{
  const directory=mkdtempSync(join(tmpdir(),'bros-poll-test-'));
  try {
    let repo=createRepository(join(directory,'test.sqlite'));
    const p=repo.create(draft);
    repo.vote(p.id,'voter',1);repo.close();
    repo=createRepository(join(directory,'test.sqlite'));
    assert.deepEqual(repo.get(p.id).counts,[0,1]);repo.close();
  } finally {rmSync(directory,{recursive:true});}
});
test('private ideas never appear in public payloads or ordinary results',async()=>{
  const repo=createRepository(':memory:');
  try {
    const poll=repo.create({...draft,guildId:'g',channelId:'c',createdBy:'owner'});
    const voted=repo.vote(poll.id,'voter',undefined,'SECRET IDEA');
    const payload=pollMessage(voted);
    assert.equal(JSON.stringify(payload).includes('SECRET IDEA'),false);
    let reply;
    const interaction={customId:`poll:${poll.id}:results`,user:{id:'viewer'},guildId:'g',channelId:'c',memberPermissions:{has:()=>false},deferReply:async()=>{},editReply:async p=>{reply=p;}};
    await handlePollInteraction(interaction,()=>repo);
    assert.equal(JSON.stringify(reply).includes('SECRET IDEA'),false);
    await assert.rejects(handlePollInteraction({...interaction,customId:`poll:${poll.id}:ideas`},()=>repo),/Only the poll creator/);
    await handlePollInteraction({...interaction,user:{id:'owner'},customId:`poll:${poll.id}:ideas`},()=>repo);
    assert.match(reply.files[0].attachment.toString(),/SECRET IDEA/);
  } finally {repo.close();}
});
test('Google Sheet events remain queued until webhook accepts them',async()=>{
  const repo=createRepository(':memory:');
  const originalFetch=globalThis.fetch;
  const previousUrl=process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const previousSecret=process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  try {
    process.env.GOOGLE_SHEETS_WEBHOOK_URL='https://example.test/webhook';
    process.env.GOOGLE_SHEETS_WEBHOOK_SECRET='test-secret';
    repo.queueSheetEvent('vote.saved',{pollId:'poll'});
    globalThis.fetch=async()=>new Response(JSON.stringify({ok:false,error:'no'}),{headers:{'content-type':'application/json'}});
    await flushSheetEvents(repo);
    assert.equal(repo.pendingSheetEvents().length,1);
    globalThis.fetch=async(_url,options)=>{assert.equal(JSON.parse(options.body).secret,'test-secret');return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});};
    await flushSheetEvents(repo);
    assert.equal(repo.pendingSheetEvents().length,0);
  } finally {
    globalThis.fetch=originalFetch;
    if (previousUrl===undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_URL; else process.env.GOOGLE_SHEETS_WEBHOOK_URL=previousUrl;
    if (previousSecret===undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET; else process.env.GOOGLE_SHEETS_WEBHOOK_SECRET=previousSecret;
    repo.close();
  }
});

test('poll Sheet sync rejects placeholder and unpublished Apps Script URLs', () => {
  const previousUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const previousSecret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;
  try {
    process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = 'test-secret';
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'your_apps_script_exec_url';
    assert.equal(pollSheetsConfigured(), false);
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/test/dev';
    assert.equal(pollSheetsConfigured(), false);
    process.env.GOOGLE_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/test/exec';
    assert.equal(pollSheetsConfigured(), true);
  } finally {
    if (previousUrl === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_URL; else process.env.GOOGLE_SHEETS_WEBHOOK_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.GOOGLE_SHEETS_WEBHOOK_SECRET; else process.env.GOOGLE_SHEETS_WEBHOOK_SECRET = previousSecret;
  }
});
