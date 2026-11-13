/** Verify this exact clean tree is the release tag, not just an uncommitted ZIP or a branch. */
import {execFileSync} from 'node:child_process';
function git(args){return execFileSync('git',args,{encoding:'utf8'}).trim()}
try{
 const sha=git(['rev-parse','HEAD']);
 if(git(['status','--porcelain']))throw Error('Dirty worktree: commit generated evidence and manifest before tagging');
 const tags=git(['tag','--points-at','HEAD']).split('\n').filter(t=>/^v3\.10\.\d+$/.test(t));
 if(!tags.length)throw Error('No v3.10.x release tag points at HEAD');
 const envRef=process.env.GITHUB_REF;
 if(envRef){
  if(!envRef.startsWith('refs/tags/'))throw Error('Release gate must run on a tag ref, not a branch or dispatch ref');
  const tag=envRef.slice('refs/tags/'.length);
  if(!tags.includes(tag))throw Error('GITHUB_REF does not match tag at HEAD');
 }
 if(process.env.GITHUB_SHA && process.env.GITHUB_SHA.toLowerCase()!==sha.toLowerCase())throw Error('Runner HEAD differs from GITHUB_SHA');
 console.log(`TAGGED SHA VERIFIED: ${sha} (${tags.join(', ')})`);
}catch(e){console.error(`RELEASE NOT TAGGED: ${e.message}`);process.exitCode=1}
