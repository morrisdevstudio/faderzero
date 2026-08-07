import { describe, expect, it } from 'vitest';
import { STATUSES, validateInventory } from '../inventoryValidation';
const valid=(icon:Record<string,unknown>={occurrenceId:'one'})=>({schemaVersion:1,unknownRoot:true,icons:[{unknownField:true,...icon}]});
describe('inventory validation',()=>{
 it('accepts valid documents and unknown fields',()=>{const v=valid();validateInventory(v);expect(v.unknownRoot).toBe(true);expect(v.icons[0].unknownField).toBe(true);});
 it.each([null,[],{}, {schemaVersion:1,icons:{}}, {schemaVersion:1,icons:[null]}, {schemaVersion:1,icons:[{}]}, {schemaVersion:1,icons:[{occurrenceId:''}]}])('rejects invalid shape %#',(v)=>expect(()=>validateInventory(v)).toThrow());
 it('rejects duplicate ids',()=>expect(()=>validateInventory({schemaVersion:1,icons:[{occurrenceId:'a'},{occurrenceId:'a'}]})).toThrow('DUPLICATE'));
 it('accepts optional proposal and decision',()=>expect(()=>validateInventory(valid())).not.toThrow());
 it.each([...STATUSES])('accepts status %s',(status)=>expect(()=>validateInventory(valid({occurrenceId:'one',decision:{status}}))).not.toThrow());
 it('rejects unknown status',()=>expect(()=>validateInventory(valid({occurrenceId:'one',decision:{status:'wrong'}}))).toThrow('INVALID_STATUS'));
});
