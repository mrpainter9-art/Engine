# Engine

혼자서 가벼운 2D 도트 게임을 만들기 위한 나만의 작은 엔진이에요.
Claude와 함께 한 단계씩, 원리를 배우면서 처음부터 다시 만들고 있어요.

- 계획과 단계별 진행: [docs/PLAN.md](docs/PLAN.md)
- 컴포넌트: [docs/BLOCKS.md](docs/BLOCKS.md) · 장면 파일: [docs/SCENES.md](docs/SCENES.md) · 편집 도구: [docs/EDITOR.md](docs/EDITOR.md)

## 처음 한 번만 준비하기
1. [Node.js](https://nodejs.org/) LTS를 설치해요.
2. [GitHub Desktop](https://desktop.github.com/)을 설치하고 GitHub 계정으로 로그인해요.
3. GitHub Desktop에서 **File → Clone repository** → `mrpainter9-art/Engine`을 골라 내 컴퓨터로 받아요.

## 실행하기
1. 받은 폴더의 `start.bat`을 두 번 눌러요. (맥은 `start.sh`)
2. 브라우저가 저절로 열리고 엔진 화면이 나와요. 끄려면 검은 창을 닫으면 돼요.

## 화면에서 고치기 (편집 도구)
`start.bat`으로 연 화면 위쪽의 **✎ 편집하기**를 누르면 게임이 멈추고, 장면 위에 패널이 떠요(끌어서 옮기고 크기 조절).
**프로젝트** 패널의 프리팹을 장면으로 끌어 놓고, **고치기**에서 값과 컴포넌트를 바꿔요. **저장**(Ctrl+S)을 누르면 JSON 파일에 써져요.
자세한 사용법: [docs/EDITOR.md](docs/EDITOR.md)

## 게임 파일 하나로 내보내기
1. `export.bat`을 두 번 눌러요. (맥은 `export.sh`)
2. `export` 폴더가 열리고 `game.html` 하나가 생겨요. 그림, 소리, 글꼴이 모두 이 파일 안에 들어 있어요.
3. 이 파일을 두 번 누르면 바로 게임이 열리고, 친구에게 보내거나 itch.io 같은 곳에 올릴 수 있어요.
   이름과 창 제목은 `src/settings.json`의 `title`이에요.

## 최신으로 바꾸기
GitHub Desktop 위쪽의 **Fetch origin** → **Pull origin**을 누르면 끝이에요. 다시 내려받을 필요 없어요.
아직 합치지 않은 PR을 미리 보고 싶으면, 위쪽 **Current branch**에서 `claude/...`로 시작하는 가지를 고르고 `start.bat`을 누르면 돼요.

이전 버전(에디터 포함 첫 시도)은 git 기록의 커밋 `0fb485f`에 그대로 남아 있어요.

글꼴: [갈무리](https://galmuri.quiple.dev) (Lee Minseo, SIL Open Font License 1.1)
