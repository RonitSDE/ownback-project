/** An exact release tag must point to a clean HEAD, with matching package and evidence versions. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {assertReleaseIdentity} from './release-identity.mjs';
function git(args){return execFileSync('git',args,{encoding:'utf8'}).trim()}
try{
 const version=JSON.parse(readFileSync('package.json','utf8')).version;
 const proofRelease=JSON.parse(readFileSync('evidence/proofs.json','utf8')).release;
 const expectedTag=assertReleaseIdentity(version,proofRelease);
 const sha=git(['rev-parse','HEAD']);
 if(git(['status','--porcelain']))throw Error('Dirty worktree: commit generated evidence and manifest before tagging');
 const tags=git(['tag','--points-at','HEAD']).split('\n').filter(Boolean);
 if(!tags.includes(expectedTag))throw Error(`Expected exact release tag ${expectedTag} pointing at HEAD (found: ${tags.join(', ')||'none'})`);
 const envRef=process.env.GITHUB_REF;
 if(envRef && envRef!==`refs/tags/${expectedTag}`)throw Error(`Release gate must run on exact tag refs/tags/${expectedTag}, not ${envRef}`);
 if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA.toLowerCase()!==sha.toLowerCase())throw Error('Runner HEAD differs from GITHUB_SHA');
 console.log(`TAGGED SHA VERIFIED: ${sha} (${expectedTag})`);
}catch(e){console.error(`RELEASE NOT TAGGED: ${e.message}`);process.exitCode=1}
