import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const web=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const repo=path.resolve(web,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(repo,'deployment/demo-transactions.json'),'utf8'));
if(!/^[0-9a-f]{40}$/.test(manifest.assetCommit))throw new Error('Invalid demo asset commit');
const hashes={};
for(const file of ['concept.svg','draft.mp4','final.mp4']){
  // Read raw Git object bytes. Windows checkout autocrlf changes SVG fingerprints.
  const bytes=execFileSync('git',['-C',repo,'show',`${manifest.assetCommit}:deployment/demo-assets/${file}`]);
  const target=path.join(web,'public/demo',file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  hashes[file]=createHash('sha256').update(bytes).digest('hex');
}
fs.writeFileSync(path.join(web,'public/demo/hashes.json'),JSON.stringify({sourceCommit:manifest.assetCommit,hashes},null,2)+'\n');
console.log(JSON.stringify(hashes));
