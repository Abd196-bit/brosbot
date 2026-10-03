'use client';
import { useState } from 'react';

export default function PollComposer() {
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState(['', '']);
  const [allowText, setAllowText] = useState(true);
  const [status, setStatus] = useState('');
  async function copy() {
    try {
      await navigator.clipboard.writeText([question, ...answers.map((v,i)=>`Answer ${i+1}: ${v}`), `Written answers: ${allowText ? 'on' : 'off'}`].join('\n'));
      setStatus('Draft notes copied. Run /poll in Discord to create and publish it.');
    } catch { setStatus('Clipboard access was unavailable. Your draft is still shown here.'); }
  }
  return <section className="card composer">
    <p className="eyebrow">PLAN YOUR POLL</p>
    <h2>One question. Every voice.</h2>
    <p className="muted">Prepare your answers here. Open the private editor with <code>/poll</code> in Discord to publish.</p>
    <label>Question<input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={200} placeholder="What should we build next?" /></label>
    {answers.map((answer,i)=><label key={i}>Answer {i+1}<input value={answer} maxLength={80} placeholder={i===0?'A tiny platformer':i===1?'A puzzle game':'Another answer'} onChange={e=>setAnswers(answers.map((v,j)=>i===j?e.target.value:v))}/></label>)}
    <div className="two">
      <button type="button" disabled={answers.length>=10} onClick={()=>setAnswers([...answers,''])}>＋ Add answer</button>
      <button type="button" disabled={answers.length<=2} onClick={()=>setAnswers(answers.slice(0,-1))}>Remove last answer</button>
    </div>
    <label className="check"><input type="checkbox" checked={allowText} onChange={e=>setAllowText(e.target.checked)}/>Allow written answers</label>
    <p className="hint">People can write their own answer in a separate private popup. One vote per person; a new answer replaces their previous vote.</p>
    <button type="button" onClick={copy}>Copy draft notes</button>
    <p role="status">{status}</p>
  </section>;
}
