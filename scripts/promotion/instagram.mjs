export function graphRequest(connection,path,params={},method='GET') {
  if(!['instagram','facebook'].includes(connection.loginMode))throw new Error('Invalid Instagram login mode');
  if(!/^v\d+\.0$/.test(connection.graphVersion))throw new Error('Graph version must look like v24.0');
  if(!/^(me|\d+)(\/[a-z_]+)?$/.test(path))throw new Error('Invalid Instagram API path');
  if(!connection.accessToken)throw new Error('Instagram token is missing');
  const host=connection.loginMode==='instagram'?'graph.instagram.com':'graph.facebook.com';
  const url=new URL(`https://${host}/${connection.graphVersion}/${path}`);
  const options={method,headers:{Authorization:`Bearer ${connection.accessToken}`}};
  if(method==='GET')url.search=new URLSearchParams(params).toString();
  else options.body=new URLSearchParams(params);
  return {url,options};
}
export function verifiedProfile(profile,expectedHandle) {
  const accountId=String(profile.user_id||profile.id||'');
  const username=profile.username;
  if(!/^\d+$/.test(accountId)||!username)throw new Error('Instagram did not return an account ID and username');
  if(!expectedHandle)throw new Error('Configure the intended Instagram handle before connecting');
  if(username.toLowerCase()!==expectedHandle.replace(/^@/,'').toLowerCase())throw new Error('This token belongs to a different Instagram account. Use the configured organisation account.');
  return {accountId,username};
}
