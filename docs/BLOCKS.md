# 행동 블록 목록

물건의 종류는 `src/kinds.json`에서 **그림 + 블록 목록**으로 만들어요. 블록은 위에서부터 차례로 실행돼요.
장면 파일(`src/scenes/main.json`)의 한 줄에 같은 이름의 값을 적으면 그 물건만 값이 바뀌어요. 예: `{ "kind": "slime", "x": 200, "y": 90, "distance": 90 }`

| 블록 이름 | 하는 일 | 값 (기본값) |
| --- | --- | --- |
| `move-with-keys` | 방향키(조작 설정의 left/right/up/down)로 움직여요. 단단한 물건에 막혀요 | `speed` 1초에 몇 픽셀 (90), `axes` both 네 방향 / horizontal 좌우만, 점프 게임용 (both) |
| `patrol` | 처음 자리에서 오른쪽으로 갔다가 돌아오기를 반복해요. 벽에 닿아도 돌아서요 | `speed` (30), `distance` 얼마나 멀리, 0이면 벽까지 (60), `edges` true면 발판 끝에서 떨어지지 않고 돌아서요 (false) |
| `bob` | 둥실둥실 위아래로 움직여요 | `height` 몇 픽셀 (2), `speed` 빠르기 (3) |
| `chase` | 가장 가까운 대상 종류에게 다가가요 | `target` 대상 종류 (player), `speed` (20), `range` 이 거리 안에 들어오면 쫓아요, 0이면 항상 (0) |
| `face-movement` | 움직이는 쪽을 바라봐요 (그림 좌우 뒤집기). 움직이는 블록 뒤에 두세요 | 없음 |
| `stay-in-world` | 맵(월드) 밖으로 나가지 않아요. 움직이는 블록 뒤에 두세요 | `bottom` false면 아래로는 떨어질 수 있어요, 구덩이용 (true) |
| `camera-follow` | 카메라가 이 물건을 따라가요. 보통 플레이어에 하나만 넣어요 | `speed` 따라붙는 빠르기, 클수록 바짝, 0이면 딱 붙어서 (5) |
| `vanish-on-touch` | 대상 종류가 닿으면 사라져요 (코인 줍기) | `by` 누가 닿으면 (player), `score` 사라질 때 점수에 더할 값 (0), `sound` 사라질 때 소리 ("") |
| `send-back-on-touch` | 닿은 대상 종류를 처음 자리로 돌려보내요 (적) | `target` 대상 종류 (player), `sound` 돌려보낼 때 소리 ("") |
| `solid` | 단단해져요. 다른 물건이 뚫고 지나가거나 떨어지지 못해요 (바닥, 벽, 발판) | 없음 |
| `gravity` | 아래로 떨어지다가 단단한 물건 위에 서요 | `strength` 떨어지는 힘, 클수록 빨리 떨어져요 (600), `maxFall` 가장 빠른 낙하 속도 (300) |
| `jump` | 서 있을 때 점프 키를 누르면 뛰어올라요. `gravity` 앞에 두세요 | `power` 클수록 높이 (240), `key` 조작 설정의 동작 이름 (jump), `sound` 뛸 때 소리 ("") |
| `respawn-on-fall` | 맵 아래로 떨어지면 처음 자리로 돌아와요 | 없음 |
| `animate-by-movement` | 움직임에 맞는 애니메이션을 골라요 (서 있기, 걷기, 공중). 움직이는 블록 뒤에 두세요 | `idle` 서 있을 때 (""), `walk` 걸을 때 (walk), `air` 공중에 있을 때 (jump). ""이면 종류의 기본 그림 |

새 블록이 필요하면 "이런 블록 만들어 줘"라고 말해 주세요. 블록 하나 = `src/behaviors/` 안의 파일 하나 + `main.ts`의 등록 한 줄이에요.
블록이 하나도 없는 종류(예: 나무)는 그 자리에 가만히 있는 장식이 돼요.
장면 한 줄에 `w`(가로), `h`(세로)를 적으면 그림보다 크게 놓을 수 있어요. 그림이 타일처럼 반복돼요. 예: `{ "kind": "ground", "x": 0, "y": 164, "w": 336 }`
블록 이름을 잘못 적으면 화면 위에 빨간 띠로 알려 줘요.

## 애니메이션
애니메이션 그림은 같은 크기의 그림을 **가로로 나란히 붙인 한 장**이에요(예: 16x16 그림 4장 = 64x16 `player-walk.png`).
kinds.json에서 `frames`(몇 장인지)와 `fps`(1초에 몇 장 넘길지)를 적어요.
- 종류의 기본 그림이 계속 움직이게: `"coin": { "image": "coin-spin", "frames": 4, "fps": 8, ... }`
- 상황마다 다른 그림: `"animations": { "walk": { "image": "player-walk", "frames": 4, "fps": 10 }, "jump": { "image": "player-jump" } }`
  어떤 애니메이션을 틀지는 블록이 골라요(`animate-by-movement`). 없는 이름이면 기본 그림이 나와요.

## 소리
`assets/sounds/` 폴더에 wav, mp3, ogg 파일을 넣으면 파일 이름으로 써요 (`coin.wav` → `"coin"`).
- 블록의 `sound` 값에 이름을 적으면 그 순간 소리가 나요. 비워 두면(`""`) 소리 없음.
- 배경 음악은 장면 파일의 `"music"`, 클리어/실패 소리는 `rules.json`의 `winSound`, `loseSound`.
- 크기는 `settings.json`의 `soundVolume`(효과음), `musicVolume`(음악), 0~1.
- 브라우저 규칙 때문에 첫 키를 누르거나 클릭한 다음부터 소리가 나요.
