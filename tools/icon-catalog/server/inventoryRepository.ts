import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Inventory, validateInventory } from './inventoryValidation';
export interface InventoryFileSystem { readFile(path:string,encoding:'utf8'):Promise<string>; writeFile(path:string,data:string,encoding:'utf8'):Promise<void>; rename(from:string,to:string):Promise<void>; unlink(path:string):Promise<void>; exists(path:string):Promise<boolean>; }
const fs:InventoryFileSystem={readFile,writeFile,rename,unlink,exists:async p=>access(p).then(()=>true).catch(()=>false)};
export const revision=(content:string)=>`sha256:${createHash('sha256').update(content).digest('hex')}`;
const repositoryError=(code:string,cause:unknown)=>Object.assign(new Error(`${code}:${cause instanceof Error?cause.message:'unknown'}`),{code,cause});
const wait=(milliseconds:number)=>new Promise<void>((resolveWait)=>setTimeout(resolveWait,milliseconds));
async function renameAtomically(io:InventoryFileSystem, from:string, to:string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try { await io.rename(from,to); return; }
    catch (error:any) { lastError=error; if (error?.code!=='EPERM' || attempt===9) break; await wait(100); }
  }
  throw repositoryError('ATOMIC_RENAME_FAILED',lastError);
}
export class InventoryRepository { constructor(private file:string,private io:InventoryFileSystem=fs) {} async read(){const content=await this.io.readFile(this.file,'utf8');const inventory=JSON.parse(content);validateInventory(inventory);return {inventory,revision:revision(content)};}
 async save(inventory:Inventory,expected:string){if((await this.read()).revision!==expected)throw Object.assign(new Error('REVISION_CONFLICT'),{code:'REVISION_CONFLICT'});validateInventory(inventory);const content=`${JSON.stringify(inventory,null,2)}\n`,temp=join(dirname(this.file),`.icon-inventory.${randomUUID()}.tmp`);let result:any,primary:unknown;try{try{await this.io.writeFile(temp,content,'utf8');}catch(error){throw repositoryError('TEMP_WRITE_FAILED',error);}let raw;try{raw=await this.io.readFile(temp,'utf8');}catch(error){throw repositoryError('TEMP_READ_FAILED',error);}let check;try{check=JSON.parse(raw);validateInventory(check);}catch(error){throw repositoryError('TEMP_INVALID',error);}await renameAtomically(this.io,temp,this.file);result={inventory:check,revision:revision(content)};}catch(error){primary=error;}const exists=await this.io.exists(temp);if(exists){try{await this.io.unlink(temp);}catch(cleanup:any){if(cleanup?.code!=='ENOENT'&&!primary)console.warn('Inventory temporary cleanup failed');}}if(primary)throw primary;return result;}
}
