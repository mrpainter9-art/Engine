import { api } from '../api';
import { reloadChanged, log } from '../state';
import { h, clear, toast } from '../ui';

const LABEL: Record<string, string> = { M: '수정', A: '추가', D: '삭제', R: '이름변경', '??': '새 파일', '?': '새 파일', U: '충돌' };

/** Godot's Version Control dock, simplified: changed files, a diff, commit, pull and push. */
export function createGitPanel(): HTMLElement {
  const files = h('div', { class: 'tree git-files' });
  const diff = h('pre', { class: 'diff' });
  const branch = h('span', { class: 'muted' });
  const msg = h('textarea', { rows: 2, placeholder: '무엇을 바꿨는지 한 줄로 (예: 브리엔츠 호수 배경 추가)' });
  const history = h('div', { class: 'git-log' });
  let busy = false;

  const run = async (name: string, body = {}, okText = '') => {
    if (busy) return; busy = true;
    try { const r = await api(name, body); if (okText) toast(okText); if (r.out) log(r.out.trim()); }
    catch (e) { toast((e as Error).message, 'error'); log((e as Error).message, 'error'); }
    finally { busy = false; await refresh(); }
  };

  const showDiff = async (path?: string) => {
    const { text } = await api('git/diff', { path });
    clear(diff);
    for (const line of (text || '바뀐 내용이 없어요.').split('\n'))
      diff.append(h('div', { class: line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : '' }, line || ' '));
  };

  const refresh = async () => {
    clear(files);
    let st;
    try { st = await api('git/status'); } catch (e) { files.append(h('div', { class: 'muted pad' }, (e as Error).message)); return; }
    if (!st.isRepo) {
      branch.textContent = 'Git 저장소가 아니에요';
      files.append(h('div', { class: 'pad' }, h('p', { class: 'muted' }, '이 프로젝트 폴더는 아직 버전 관리를 하지 않아요.'),
        h('button', { onclick: () => run('git/init', {}, 'Git 저장소를 만들었어요') }, 'Git 저장소 만들기')));
      return;
    }
    branch.textContent = `브랜치 ${st.branch}${st.ahead ? ` · 올릴 커밋 ${st.ahead}` : ''}${st.behind ? ` · 받을 커밋 ${st.behind}` : ''}`;
    if (!st.files.length) files.append(h('div', { class: 'muted pad' }, '바뀐 파일이 없어요.'));
    for (const f of st.files)
      files.append(h('div', { class: 'row', title: f.path, onclick: () => showDiff(f.path) },
        h('span', { class: 'git-st st-' + f.status.replace('?', 'q') }, LABEL[f.status] || f.status), h('span', { class: 'name' }, f.path.replace('res://', ''))));
    const { commits } = await api('git/log');
    clear(history);
    for (const c of commits) history.append(h('div', { class: 'git-commit', title: `${c.hash} ${c.author}` }, h('span', { class: 'muted' }, c.when + ' '), c.subject));
  };

  const commit = async () => {
    await run('git/commit', { message: msg.value }, '커밋했어요');
    msg.value = '';
  };

  setTimeout(refresh);
  return h('div', { class: 'panel git' },
    h('div', { class: 'panel-tools' }, branch, h('span', { class: 'grow' }),
      h('button', { class: 'tool', title: '새로 고침', onclick: refresh }, '⟳'),
      h('button', { class: 'tool', title: '원격 저장소에서 받기 (git pull)', onclick: async () => { await run('git/pull', {}, '받아 왔어요'); await reloadChanged(); } }, '⬇ 받기'),
      h('button', { class: 'tool', title: '원격 저장소로 올리기 (git push)', onclick: () => run('git/push', {}, '올렸어요') }, '⬆ 올리기')),
    h('div', { class: 'git-body' },
      h('div', { class: 'git-left' }, files, msg, h('button', { class: 'primary', onclick: commit }, '커밋 (모두 담기)'), h('div', { class: 'dock-title' }, '최근 커밋'), history),
      diff));
}
