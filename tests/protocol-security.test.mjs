import test from 'node:test';import assert from 'node:assert/strict';
import {validSymbol,researchPrompt,makeJobToken,verifyJobToken} from '../src/lib/bankr/research.ts';
import {bankrJobToOutcome} from '../src/lib/bankr/agent-actions.ts';
test('only explicitly permitted securities appear in read-only research',()=>{assert.equal(validSymbol('AAPLc'),true);for(const s of ['abc;remove','DOGE','ETH',''] )assert.equal(validSymbol(s),false)});
test('research prompt explicitly forbids transactions and invented eligibility',()=>{const s=researchPrompt('AAPLc');assert.match(s,/No transactions/);assert.match(s,/Do NOT assume token eligibility/);assert.throws(()=>researchPrompt('DROP TABLE'))});
test('research job links expire and reject forged signatures',()=>{const secret='a'.repeat(64),expiry=Math.floor(Date.now()/1000)+300,id='job_abc123',token=makeJobToken(id,expiry,secret);assert.equal(verifyJobToken(id,expiry,token,secret),true);assert.equal(verifyJobToken('job_wrong',expiry,token,secret),false);assert.equal(verifyJobToken(id,expiry,token.slice(0,-1)+'0',secret),false);assert.equal(verifyJobToken(id,Math.floor(Date.now()/1000)-1,token,secret),false)});
test('completed Bankr AI job is NOT a verified customer loan',()=>{const o=bankrJobToOutcome({jobId:'job_1',status:'completed',response:'I am done'});assert.equal(o.ok,false);assert.match(o.message,/no loan is considered open/i)});
