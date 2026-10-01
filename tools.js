import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),cache={};
// Finds an installed CLI tool (env override first). Returns its command name or null.
export async function findBin(names,arg,envVar){
  if(cache[names[0]])return cache[names[0]];
  for(const n of [process.env[envVar],...names].filter(Boolean)){
    try{await run(n,[arg]);return cache[names[0]]=n}catch(e){if(e.code!=='ENOENT')return cache[names[0]]=n}
  }
  return null;
}
