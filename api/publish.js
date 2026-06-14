// ============================================================
//  Assure Gold - Secure Publish function (Vercel Serverless)
//  Path: /api/publish   (file lives at  api/publish.js  in repo root)
//
//  - Holds the GitHub token SERVER-SIDE only (never sent to browser).
//  - Holds the editor passcode SERVER-SIDE only (Vercel env EDITOR_CODE),
//    so it is NOT visible in the public page source or the public repo.
//  - Two actions:
//      { action:'auth', code }            -> just checks the passcode
//      { code, files:[...], message }     -> checks passcode, then commits
// ============================================================

var REPO_OWNER   = process.env.GITHUB_OWNER  || 'assuregoldsg1-star';
var REPO_NAME    = process.env.GITHUB_REPO   || 'Arun-Prabha';
var BRANCH       = process.env.GITHUB_BRANCH || 'main';
var GITHUB_TOKEN = process.env.GITHUB_TOKEN;          // <-- SECRET (set in Vercel)
var EDITOR_CODE  = process.env.EDITOR_CODE;           // <-- passcode (set in Vercel, e.g. 960511)

var GH = 'https://api.github.com';

async function gh(path, method, body){
  var res = await fetch(GH + path, {
    method: method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'assure-gold-publisher',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  var text = await res.text();
  var data; try { data = JSON.parse(text); } catch(e){ data = text; }
  if(!res.ok){
    var msg = (data && data.message) ? data.message : text;
    throw new Error('GitHub ' + method + ' ' + path + ' -> ' + res.status + ': ' + msg);
  }
  return data;
}

module.exports = async function(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if(req.method === 'OPTIONS'){ res.status(204).end(); return; }
  if(req.method !== 'POST'){ res.status(405).json({error:'Method not allowed'}); return; }

  if(!EDITOR_CODE){ res.status(500).json({error:'Server not configured: EDITOR_CODE is missing in Vercel.'}); return; }

  try {
    var body = req.body;
    if(typeof body === 'string'){ body = JSON.parse(body); }
    body = body || {};

    // 1) Passcode check (used by both the unlock step and publishing)
    if(String(body.code || '') !== String(EDITOR_CODE)){
      res.status(401).json({error:'Wrong passcode.'});
      return;
    }

    // Unlock-only request
    if(body.action === 'auth'){
      res.status(200).json({ ok:true });
      return;
    }

    if(!GITHUB_TOKEN){ res.status(500).json({error:'Server not configured: GITHUB_TOKEN is missing in Vercel.'}); return; }

    // Return FRESH file contents straight from GitHub (no CDN cache) so the
    // editor always patches the true current version of each page.
    if(body.action === 'getfiles'){
      var want = body.paths || [];
      var result = {};
      for(var gi=0; gi<want.length; gi++){
        try{
          var info = await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/contents/'+want[gi]+'?ref='+BRANCH);
          result[want[gi]] = Buffer.from(info.content || '', 'base64').toString('utf-8');
        }catch(e){ result[want[gi]] = null; }
      }
      res.status(200).json({ ok:true, files: result });
      return;
    }

    var files = body.files || [];
    var message = body.message || 'Website update via manager';
    if(!files.length){ res.status(400).json({error:'No files to publish.'}); return; }

    // 2) Latest commit + its tree
    var ref = await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/git/ref/heads/'+BRANCH);
    var latestSha = ref.object.sha;
    var commit = await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/git/commits/'+latestSha);
    var baseTree = commit.tree.sha;

    // 3) Blob per file
    var treeItems = [];
    for(var i=0; i<files.length; i++){
      var f = files[i];
      var enc = (f.encoding === 'base64') ? 'base64' : 'utf-8';
      var blob = await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/git/blobs', 'POST',
        { content: f.content, encoding: enc });
      treeItems.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 4) New tree, commit, move branch
    var tree = await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/git/trees', 'POST',
      { base_tree: baseTree, tree: treeItems });
    var newCommit = await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/git/commits', 'POST',
      { message: message, tree: tree.sha, parents: [latestSha] });
    await gh('/repos/'+REPO_OWNER+'/'+REPO_NAME+'/git/refs/heads/'+BRANCH, 'PATCH',
      { sha: newCommit.sha });

    res.status(200).json({ ok: true, commit: newCommit.sha, count: files.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
