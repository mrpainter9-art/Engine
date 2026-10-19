# 장면 파일

`src/scenes/` 폴더의 JSON 파일 하나가 장면 하나예요 (타이틀, 스테이지...). 파일 이름이 장면 이름이에요 (`stage1.json` → `stage1`).
게임은 `settings.json`의 `firstScene` 장면부터 시작해요.

| 항목 | 하는 일 | 예 |
| --- | --- | --- |
| `size` | 맵 크기(픽셀). 없으면 화면 한 장 | `{ "width": 960, "height": 180 }` |
| `background` | 하늘색. 없으면 `modules/background/background.json`의 색 | `"#f6b26b"` |
| `music` | 반복되는 배경 음악 (`assets/sounds`의 이름). 다음 장면도 같은 곡이면 끊기지 않아요 | `"song"` |
| `texts` | 화면에 고정된 글자들. `scale` 2는 두 배 크기 | `[{ "text": "작은 엔진", "x": 160, "y": 30, "align": "center", "color": "#f2c14e", "scale": 2 }]` |
| `rules` | 이 장면의 게임 규칙. `rules.json`의 값 중 바꿀 것만 적어요. **없으면 메뉴 장면**(스페이스를 누르면 `next`로) | `{ "timeLimit": 50 }` |
| `next` | 클리어하고 스페이스를 누르면 갈 장면. 없으면 같은 장면을 다시 | `"stage2"` |
| `objects` | 물건 배치: 종류, 위치, 그 물건만 바꿀 값, 크게 놓을 `w`/`h` | `{ "kind": "slime", "x": 360, "y": 148, "speed": 50 }` |

흐름: 클리어 → 스페이스 → `next` 장면. 시간 초과 → 스페이스 → 같은 장면 처음부터.
새 스테이지는 기존 파일을 복사해서 이름만 바꾸고, 앞 장면의 `next`를 새 이름으로 바꾸면 이어져요.
