import { apiStream, api } from '../api';
import { ed, reloadChanged, log } from '../state';
import { h, toast } from '../ui';

/**
 * Runs Claude Code or Codex in the project folder. The editor adds a short engine summary and what is open
 * (scene, selected node, script), so the agent starts in the right place: fewer tokens spent exploring.
 */
export function createAiPanel(): HTMLElement {
  const saved = (() => { try { return JSON.parse(localStorage.getItem('engine.ai') || '{}'); } catch { return {}; } })();
  const agent = h('select', null, h('option', { value: 'claude' }, 'Claude Code'), h('option', { value: 'codex' }, 'Codex'));
  agent.value = saved.agent || 'claude';
  const mode = h('select', { title: '질문만: 파일을 고치지 않아요. 수정 허용: 프로젝트 파일을 고칠 수 있어요.' }, h('option', { value: 'ask' }, '질문만'), h('option', { value: 'edit' }, '수정 허용'));
  mode.value = saved.mode || 'ask';
  const resume = h('input', { type: 'checkbox', checked: !!saved.resume });
  const ctxScene = h('input', { type: 'checkbox', checked: true });
  const prompt = h('textarea', { rows: 3, placeholder: '예: 구름이 천천히 흐르는 Parallax2D를 추가해줘  (Ctrl+Enter로 보내기)' });
  const out = h('div', { class: 'ai-out' });
  const sendBtn = h('button', { class: 'primary' }, '보내기');
  const stopBtn = h('button', { disabled: true }, '멈추기');
  let running = false;

  const remember = () => { try { localStorage.setItem('engine.ai', JSON.stringify({ agent: agent.value, mode: mode.value, resume: resume.checked })); } catch { /* private window */ } };
  [agent, mode, resume].forEach((el) => el.addEventListener('change', remember));

  const add = (cls: string, text: string) => {
    const last = out.lastElementChild as HTMLElement | null;
    if (cls === 'text' && last?.classList.contains('text')) last.textContent += text;
    else out.append(h('div', { class: 'ai-' + cls }, text));
    out.scrollTop = out.scrollHeight;
  };

  const send = async () => {
    const text = prompt.value.trim();
    if (!text || running) return;
    running = true; sendBtn.disabled = true; stopBtn.disabled = false;
    out.append(h('div', { class: 'ai-user' }, text));
    prompt.value = '';
    const s = ed.current;
    const context = ctxScene.checked ? {
      scene: s?.path || undefined,
      node: s?.selected ? `${s.selected.path()} (${s.selected.type})` : undefined,
      script: ed.tab === 'script' ? ed.currentScript?.path : undefined,
    } : {};
    if (mode.value === 'edit' && ed.scenes.some((x) => x.dirty)) add('log', '저장 안 한 씬이 있어요. AI가 같은 파일을 고치면 다시 읽지 않으니 먼저 저장하는 게 좋아요.');
    try {
      await apiStream('ai/run', { agent: agent.value, mode: mode.value, resume: resume.checked, prompt: text, context }, (ev) => {
        if (ev.type === 'text') add('text', ev.text);
        else if (ev.type === 'tool') add('tool', '🔧 ' + ev.text);
        else if (ev.type === 'usage') add('usage', ev.text);
        else if (ev.type === 'error') add('error', ev.text);
        else if (ev.type === 'log') add('log', ev.text);
        else if (ev.type === 'done' && ev.code) add('error', `종료 코드 ${ev.code}`);
      });
    } catch (e) { add('error', (e as Error).message); }
    running = false; sendBtn.disabled = false; stopBtn.disabled = true;
    resume.checked = true; remember();
    await reloadChanged();
    log('AI 작업이 끝나서 바뀐 파일을 다시 읽었어요.');
  };

  sendBtn.onclick = send;
  stopBtn.onclick = async () => { await api('ai/stop'); toast('멈췄어요'); };
  prompt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });

  return h('div', { class: 'panel ai' },
    h('div', { class: 'panel-tools' }, agent, mode,
      h('label', { class: 'check', title: '앞의 대화를 이어서 해요. 같은 설명을 반복하지 않아 토큰이 줄어요.' }, resume, '이어서 대화'),
      h('label', { class: 'check', title: '열린 씬, 선택한 노드, 열린 스크립트 경로를 함께 보내요.' }, ctxScene, '지금 화면 정보 포함'),
      h('span', { class: 'grow' }), h('button', { class: 'tool', onclick: () => { out.textContent = ''; resume.checked = false; remember(); } }, '새 대화')),
    out,
    h('div', { class: 'ai-input' }, prompt, h('div', { class: 'ai-buttons' }, sendBtn, stopBtn)));
}
