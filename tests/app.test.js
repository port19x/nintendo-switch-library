import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFilters } from '../app.js';
const games=[{title:'Long Great',party:'first',score:90,hours:30,density:3},{title:'Short Gem',party:'third',score:80,hours:4,density:20},{title:'Unknown',party:'third',score:null,hours:null,density:null}];
test('filters by query, party, length, and score',()=>{assert.deepEqual(applyFilters(games,{query:'gem',party:'third',length:'5',score:'70',sort:'density'}).map(g=>g.title),['Short Gem'])});
test('unknown durations are excluded from a length filter',()=>{assert.equal(applyFilters(games,{query:'',party:'all',length:'10',score:'0',sort:'hours'}).length,1)});
test('sorts missing values last',()=>{assert.equal(applyFilters(games,{query:'',party:'all',length:'all',score:'0',sort:'score'}).at(-1).title,'Unknown')});
