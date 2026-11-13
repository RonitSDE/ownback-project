/** Update SOURCE_MANIFEST.sha256 after a deliberate release edit (not authentication). */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,relative} from 'node:path';
const excludedDirs=new Set(['.git','node_modules','.next','out','test-results','playwright-report',
  'contracts/lib','contracts/out','contracts/cache','contracts/broadcast','contracts/deployments']);
const excludedFiles=new Set(['SOURCE_MANIFEST.sha256','.env','.env.local','next-env.generated.d.ts','next-env.d.ts']);
function sourceFiles(dir='.'){
 const found=[];
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name), rel=relative('.',path).replaceAll('\\','/');
  if(entry.isDirectory()){if(!excludedDirs.has(rel))found.push(...sourceFiles(path));}
  else if(entry.isFile()){
   if(excludedFiles.has(rel)||rel.endsWith('.tsbuildinfo')||entry.name==='.DS_Store'||
     (rel.startsWith('.env.')&&rel!=='.env.example'))continue;
   found.push(rel);
  }
 }
 return found;
}
const lines=sourceFiles().sort().map(file=>`${createHash('sha256').update(readFileSync(file)).digest('hex')}  ${file}`);
writeFileSync('SOURCE_MANIFEST.sha256',lines.join('\n')+'\n');
console.log(`Updated SOURCE_MANIFEST.sha256 (${lines.length} source files).`);
