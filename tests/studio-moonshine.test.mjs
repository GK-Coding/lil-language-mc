import test from 'node:test';
import assert from 'node:assert/strict';
import {StreamHistory} from '../public/studio/stream-history.js';

test('streaming caption timestamps select their actual PCM across frame boundaries',()=>{
  const history=new StreamHistory(10,8);
  history.push(Float32Array.from([0,1,2,3]));history.push(Float32Array.from([4,5,6,7]));
  assert.deepEqual([...history.slice(.25,.5,0)],[2,3,4,5]);
  assert.deepEqual([...history.slice(0,1,0)],[0,1,2,3,4,5,6,7]);
});
test('audio history stays bounded and never labels expired audio as a current caption',()=>{
  const history=new StreamHistory(2,4);
  for(let i=0;i<3;i++)history.push(Float32Array.from({length:4},(_,n)=>i*4+n));
  assert.equal(history.frames.length,2);assert.equal(history.slice(0,1,0),null);
  assert.deepEqual([...history.slice(1,1.5,0)],[4,5,6,7,8,9]);
  assert.equal(history.slice(NaN,1),null);assert.equal(history.slice(1,-1),null);
});
