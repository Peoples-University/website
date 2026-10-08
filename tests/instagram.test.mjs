import test from 'node:test';
import assert from 'node:assert/strict';
import {graphRequest,verifiedProfile} from '../scripts/promotion/instagram.mjs';
const connection={loginMode:'instagram',graphVersion:'v24.0',accessToken:'TEST_ONLY'};
test('Instagram-only requests never use Facebook and token is not in URL',()=>{
  const r=graphRequest(connection,'me',{fields:'user_id,username'});
  assert.equal(r.url.hostname,'graph.instagram.com');assert.equal(r.url.searchParams.has('access_token'),false);
  assert.equal(r.options.headers.Authorization,'Bearer TEST_ONLY');
});
test('legacy Facebook connection remains explicit',()=>assert.equal(graphRequest({...connection,loginMode:'facebook'},'123/media',{},'POST').url.hostname,'graph.facebook.com'));
test('publishing uses same direct host and form encoding',()=>{
  const r=graphRequest(connection,'123/media',{media_type:'STORIES',image_url:'https://example.org/art.jpg'},'POST');
  assert.equal(r.options.body.get('media_type'),'STORIES');assert.equal(r.url.pathname,'/v24.0/123/media');
});
test('reject invalid version, paths and missing credentials',()=>{
  assert.throws(()=>graphRequest({...connection,graphVersion:'evil/path'},'me'));
  assert.throws(()=>graphRequest(connection,'../oauth'));
  assert.throws(()=>graphRequest({...connection,accessToken:''},'me'));
});
test('only intended organisation account can be saved',()=>{
  assert.deepEqual(verifiedProfile({user_id:'123',username:'PeoplesUniversityProject'},'peoplesuniversityproject'),{accountId:'123',username:'PeoplesUniversityProject'});
  assert.throws(()=>verifiedProfile({user_id:'123',username:'other'},'peoplesuniversityproject'));
  assert.throws(()=>verifiedProfile({user_id:'123'},'peoplesuniversityproject'));
});
