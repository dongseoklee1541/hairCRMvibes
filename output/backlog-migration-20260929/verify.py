"""2026-09-29 one-time migration audit; no writes, account access, or app tests."""
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote
from collections import Counter
import difflib, hashlib, json, os, re, subprocess, sys

ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT)
MANIFEST=json.loads(Path('output/backlog-migration-20260929/source-manifest.json').read_text())
CLI=str(ROOT/'node_modules/.bin/backlog');errors=[];stats={}
PUBLICATION='--publication' in sys.argv[1:]
def check(condition,message):
    if not condition:errors.append(message)
def run(*args):
    r=subprocess.run([CLI,*args],capture_output=True,text=True)
    check(r.returncode==0,'CLI: '+str(args)+' '+r.stderr)
    return r.stdout
def read_source(path):return subprocess.check_output(['git','show',MANIFEST['baseline']+':'+path])
def rewrite(text,old,new):
    result=[];fenced=False
    for line in text.splitlines(keepends=True):
        if re.match(r'^\s*(```|~~~)',line):fenced=not fenced
        if not fenced:
            def rep(m):
                target=m.group(2);u=urlsplit(target)
                if u.scheme or not u.path:return m.group(0)
                resolved=os.path.normpath(os.path.join(str(Path(old).parent),unquote(u.path)))
                moved=MANIFEST['documents'].get(resolved,{}).get('path',resolved)
                relative=quote(os.path.relpath(moved,Path(new).parent),safe='/.-_~')
                return m.group(1)+relative+('#'+u.fragment if u.fragment else '')+('?' +u.query if u.query else '')+m.group(3)
            line=re.sub(r'(!?\[[^\n]*?\]\()([^\s)]+)(\))',rep,line)
        result.append(line)
    return ''.join(result)
def headings(text):
    seen=Counter();result=set(re.findall(r'<a id="([^"]+)"',text))
    for label in re.findall(r'^#{1,6} (.+)$',text,re.M):
        slug=re.sub(r'\[([^]]+)\]\([^)]*\)',r'\1',label)
        slug=re.sub(r'<[^>]*>','',slug)
        slug=re.sub(r'[^\w -]','',slug.lower()).replace(' ','-')
        count=seen[slug];seen[slug]+=1;result.add(slug+('-'+str(count) if count else ''))
    return result

expected_sources={'future-todo.md'}|set(subprocess.check_output(['git','ls-tree','-r','--name-only',MANIFEST['baseline'],'docs/roadmap','docs/operations'],text=True).splitlines())
expected_sources={s for s in expected_sources if s.endswith('.md')}
check(expected_sources==set(MANIFEST['documents']),'source inventory coverage mismatch')
original_bytes=0;blocks=0;tables=0;links=0
for old,entry in MANIFEST['documents'].items():
    raw=read_source(old);original_bytes+=len(raw);original=raw.decode()
    check(hashlib.sha256(raw).hexdigest()==entry['source_sha256'],'original hash '+old)
    new=Path(entry['path']);check(new.exists(),'missing document '+str(new))
    if not new.exists():continue
    text=new.read_text();m=re.search(r'<!-- migrated-source:start -->\n(.*)\n<!-- migrated-source:end -->',text,re.S)
    check(m is not None,'missing source payload '+str(new))
    if not m:continue
    expected=rewrite(original,old,str(new));actual=m.group(1)
    if actual!=expected:
        check(False,'body loss '+old+' '+''.join(difflib.unified_diff(expected.splitlines(True),actual.splitlines(True)))[:300])
    check(hashlib.sha256(actual.encode()).hexdigest()==MANIFEST['source_bodies'][old],'migrated body hash '+old)
    code=re.findall(r'(?ms)^```.*?^```[^\n]*',original)
    check(code==re.findall(r'(?ms)^```.*?^```[^\n]*',actual),'code block changed '+old)
    blocks+=len(code);tables+=sum(l.startswith('|') for l in original.splitlines())
    legacy=Path(old).read_text()
    check(legacy.startswith('# 이동 안내\n'),'not redirect '+old)
    check(not re.search(r'^\s*\|',legacy,re.M),'legacy status table remains '+old)
    check('<!-- migrated-source:start -->' not in legacy,'legacy original body remains '+old)
    check(headings(original)<=headings(legacy),'legacy anchors lost '+old)
    check('현재' in text and '2026-09-29' in text,'migration/date notice missing '+old)
stats.update(source_documents=len(expected_sources),original_bytes=original_bytes,preserved_code_blocks=blocks,preserved_table_rows=tables)

# Every live Markdown destination and anchor, including retired-path forwarding anchors.
files=[Path('AGENTS.md'),Path('README.md'),*[Path(s) for s in MANIFEST['documents']],*Path('backlog').rglob('*.md')]
anchor_cache={}
for p in files:
    if not p.exists():continue
    fenced=False
    for line in p.read_text().splitlines():
        if re.match(r'^\s*(```|~~~)',line):fenced=not fenced
        if fenced:continue
        for target in re.findall(r'!?\[[^\n]*?\]\(([^\s)]+)\)',line):
            u=urlsplit(target)
            if u.scheme:continue
            links+=1;dest=(p.parent/unquote(u.path)) if u.path else p
            check(dest.exists(),'missing link '+str(p)+' -> '+target)
            if u.fragment and dest.exists() and dest.suffix=='.md':
                key=str(dest.resolve());anchor_cache.setdefault(key,headings(dest.read_text()))
                check(unquote(u.fragment) in anchor_cache[key],'missing anchor '+str(p)+' -> '+target)
            resolved=os.path.normpath(str(dest))
            if p.as_posix().startswith('backlog/'):
                check(resolved not in MANIFEST['documents'],'new doc still links retired path '+str(p)+' -> '+target)
stats['local_markdown_links_checked']=links

listed=json.loads(run('task','list','--json'))['tasks'];tasks={t['id']:t for t in listed}
check((len(listed)>=len(MANIFEST['tasks']) if PUBLICATION else len(listed)==len(MANIFEST['tasks'])),'native task count')
check({t['id'] for t in MANIFEST['tasks'].values()}<=set(tasks),'migrated tasks missing')
stats['tasks']=len(listed);stats['statuses']=dict(Counter(t['status'] for t in listed))
check(len(list(Path('backlog/drafts').glob('*.md')))==3,'draft count')
check(len(list(Path('backlog/decisions').glob('*.md')))==12,'decision count')
check((len(list(Path('backlog/docs').rglob('*.md')))>=44 if PUBLICATION else len(list(Path('backlog/docs').rglob('*.md')))==44),'doc count')
check(len([k for k in MANIFEST['tasks'] if re.fullmatch(r'R-\d\d',k)])==16,'formal feature count')
dependencies={2:[1],3:[5],7:[1],9:[4,8,13],10:[1,2],11:[2,3,8,10],13:[7],14:[6,13],15:[8,9],16:[2,7,8,15]}
details={}
for key,entry in MANIFEST['tasks'].items():
    task=json.loads(run('task','view',entry['id'],'--json'))['task'];details[entry['id']]=task
    check(task['assignees']==[],'invented assignee '+entry['id'])
    check(task['readiness']['missingDependencies']==[],'missing dependencies '+entry['id'])
    check('onStatusChange:' not in Path(entry['path']).read_text(),'task status callback '+entry['id'])
    for ref in task['documentation']+task['references']:
        if not urlsplit(ref).scheme:check(Path(ref).exists(),'missing metadata reference '+entry['id']+' '+ref)
    if re.fullmatch(r'R-\d\d',key):
        n=int(key.split('-')[1]);check(key in task['title'] and key in task['labels'],'lost R ID '+key)
        check(task['priority']==entry['priority'].lower(),'priority '+key)
        check(task['status']==entry['status'],'formal status '+key)
        expected={MANIFEST['tasks'][f'R-{d:02d}']['id'] for d in dependencies.get(n,[])}
        check(set(task['dependencies'])==expected,'formal dependencies '+key)
        check('이번' in task['description'] and '이관일' in task['description'],'execution/date boundary '+key)
        if task['status']=='Done':
            check(task['acceptanceCriteriaCompleted']==task['acceptanceCriteriaCount'],'unchecked Done scope '+key)
            check(bool(task['finalSummary']),'missing final summary '+key)
    elif key!='migration':check(task['status']==entry['status'],'followup status '+key)
for key in ['r10-validation','r14-observation']:
    check(tasks[MANIFEST['tasks'][key]['id']]['status']=='Waiting Validation','validation boundary '+key)
for key in ['R-11','mobile-login','device-ime','installed-pwa']:
    check(tasks[MANIFEST['tasks'][key]['id']]['status']=='On Hold','hold boundary '+key)
for source,entry in MANIFEST['drafts'].items():
    text=Path(entry['path']).read_text();check(re.search(r'^status: Draft$',text,re.M) is not None,'draft status')
    check('정식 R ID 미배정' in text and '승인 없음' in text,'candidate promoted '+source)
    check('R-17' not in text,'invented candidate R ID')
    run('draft','view',entry['id'],'--plain')
for decision in MANIFEST['decisions']:
    text=Path(decision['path']).read_text();check('status: '+decision['status'] in text,'decision proposal/accepted status')
check('status: proposed' in Path(MANIFEST['decisions'][9]['path']).read_text(),'R-11 proposal promotion')

# Query surfaces, shared search index, board, and duplicate/cycle diagnosis.
run('doc','list','--plain');run('doc','view',MANIFEST['extra_docs']['migration']['id']);run('doc','search','R-10','--limit','5')
run('draft','list','--plain');run('decision','list','--plain')
for typ,query in [('task','R-10'),('document','R-10'),('decision','R-11')]:
    result=json.loads(run('search',query,'--type',typ,'--json'))
    check(bool(result['results']),'search surface '+typ)
board=run('board','view');check('TASK-17' in board and 'TASK-18' in board and 'On Hold' in board,'board scope/status')
doctor=run('doctor');check(doctor.strip()=='No duplicate IDs, self-referential dependencies, or dependency cycles found.','doctor duplicate/cycle diagnosis '+doctor.strip())
stats['cli_surfaces']='task list/view, doc list/view/search, draft list/view, decision list, search task/document/decision, board view, doctor'

# Package/lock diff is limited to the approved dev tool and command.
package=json.loads(Path('package.json').read_text());before=json.loads(read_source('package.json'))
check(package['dependencies']==before['dependencies'],'production dependency change')
check(package['devDependencies'].get('backlog.md')=='1.53.0','not pinned exact devDependency')
check(package['scripts']=={**before['scripts'],'backlog':'backlog'},'unrelated scripts changed')
lock=json.loads(Path('package-lock.json').read_text());old_lock=json.loads(read_source('package-lock.json'))
for key,val in old_lock['packages'].items():
    if key:check(lock['packages'].get(key)==val,'unrelated lock package '+key)
for key,val in lock['packages'].items():
    if key not in old_lock['packages']:
        check(key.startswith('node_modules/backlog.md'),'unrelated added package '+key)
        check(val['version']=='1.53.0' and val.get('dev') is True,'non-dev/unpinned Backlog platform '+key)
config=Path('backlog/config.yml').read_text()
for setting in ['auto_commit: false','remote_operations: false','check_active_branches: false','bypass_git_hooks: false','default_assignee: []',"onStatusChange: ''",'priorities: ["P0", "P1", "P2"]']:
    check(setting in config,'config '+setting)
if not PUBLICATION:
    check(subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==MANIFEST['baseline'],'HEAD changed')
    check(subprocess.check_output(['git','branch','--show-current'],text=True).strip()=='main','branch changed')
changed=[p for p in subprocess.check_output(['git','diff','--name-only','-z']).decode().split('\0') if p]
allowed=set(MANIFEST['documents'])|{'AGENTS.md','README.md','package.json','package-lock.json'}
if PUBLICATION:
    allowed|={p for p in changed if p.startswith(('backlog/','output/backlog-migration-20260929/','output/backlog-publication-20260930/'))}
check(set(changed)<=allowed,'out-of-scope tracked changes')
diff=subprocess.run(['git','diff','--check'],capture_output=True,text=True);check(diff.returncode==0,'git diff --check '+diff.stdout+diff.stderr)
for p in Path('backlog').rglob('*'):
    if p.is_file():
        whitespace=subprocess.run(['git','diff','--no-index','--check','/dev/null',str(p)],capture_output=True,text=True)
        check(not whitespace.stdout and not whitespace.stderr,'new Backlog whitespace '+str(p)+' '+whitespace.stdout+whitespace.stderr)
stats['version']=run('--version').strip();stats['checks_failed']=len(errors)
print(json.dumps({'ok':not errors,'stats':stats,'errors':errors},ensure_ascii=False,indent=2))
sys.exit(1 if errors else 0)
