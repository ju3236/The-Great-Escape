// 에피소드 데이터. 새 에피소드는 같은 형식으로 SCENARIOS 배열에 추가하면 된다.
//
// map       { w, h }  지도 격자 크기
// rooms     각 구역. rect: [x, y, w, h] (격자 단위)
// starts    멤버가 처음 깨어나는 구역 목록. 멤버를 무작위로 나눠 배치한다.
// links     구역 사이 연결
//   kind    'open'  항상 지나갈 수 있는 통로
//           'door'  문. locked: true 면 잠겨 있고, 오브젝트의 onSolve.unlock 으로 연다
//           'wall'  지나갈 수 없지만 소리는 (웅얼거리며) 넘어오는 얇은 벽
//   소리는 연결 하나를 건널 때마다 한 칸씩 멀어진다.
//   속삭임: 같은 구역만 / 대사: 옆 구역까지 웅얼거림 / 외침: 옆 구역 또렷, 두 칸 웅얼거림
//
// 오브젝트 필드
//   desc        조사했을 때 나오는 설명
//   bonus       '관찰력' 특기 멤버가 조사하면 추가로 보이는 단서
//   needItem    조사하는 멤버가 갖고 있어야 하는 아이템 id
//   needAll     모든 멤버가 이 구역에 모여 있어야 함
//   lock        { answer, prompt, hint, forceable }  정답 입력 퍼즐
//   onSolve     { text, item, unlock, ending }  해결 결과 (unlock: 링크 id)
//   solvedDesc  해결 후 다시 조사했을 때 설명
//   cctv        조사하면 모든 멤버의 위치를 알려 준다
const SCENARIOS = [
  {
    id: 'bunker',
    title: '제1화 · 지하 연구소',
    summary: '멤버들은 서로 다른 감금실에서 눈을 뜬다. 흩어진 동료와 목소리로 협력해 30분 안에 지상으로 탈출하라.',
    timeLimit: 30 * 60,
    map: { w: 12, h: 9 },
    starts: ['cellA', 'cellB', 'cellC'],
    intro: [
      '삐— 삐— 삐—',
      '희미한 경보음. 차가운 콘크리트 바닥 위에서 멤버들이 각자 눈을 뜬다.',
      '옆에 있어야 할 동료들이 보이지 않는다. 벽 너머에서 누군가의 기척이 느껴진다.',
      '천장 스피커가 지직거린다. "…30분 뒤, 이 시설은 완전히 봉쇄된다. 전원, 그 전에 나가라."',
    ],
    items: {
      keycard: { name: '카드키', icon: '💳' },
      screwdriver: { name: '드라이버', icon: '🪛' },
      key: { name: '작은 열쇠', icon: '🗝️' },
      fuse: { name: '예비 퓨즈', icon: '🔌' },
    },
    hints: [
      { until: 'dA', text: '감금실 A — 멈춘 시계의 숫자를 사물함에.' },
      { until: 'dB', text: '감금실 B — 화이트보드의 동그라미 친 글자가 문 암호.' },
      { until: 'dC', text: '감금실 C — 침대 프레임을 살펴보자.' },
      { until: 'dS', text: '감금실 B의 낙서에 보안실 비밀번호가 있다.' },
      { until: 'keybox', text: '보안실 열쇠함을 열어 보자.' },
      { until: 'cabinet', text: '작은 열쇠는 연구실 캐비닛에 맞는다.' },
      { until: 'dL', text: '퓨즈를 전원 패널에 꽂고, 박사 딸의 생일을 입력.' },
      { until: 'keypad', text: '모두 엘리베이터에 모인 뒤, 감금실 A 시계 + 딸의 생일.' },
    ],
    links: [
      { id: 'wAB', a: 'cellA', b: 'cellB', kind: 'wall' },
      { id: 'wBC', a: 'cellB', b: 'cellC', kind: 'wall' },
      { id: 'wCL', a: 'cellC', b: 'lift', kind: 'wall' },
      { id: 'dA', a: 'cellA', b: 'hall', kind: 'door', locked: true },
      { id: 'dB', a: 'cellB', b: 'hall', kind: 'door', locked: true },
      { id: 'dC', a: 'cellC', b: 'hall', kind: 'door', locked: true },
      { id: 'dL', a: 'hall', b: 'lift', kind: 'door', locked: true },
      { id: 'dLab', a: 'hall', b: 'lab', kind: 'open' },
      { id: 'dS', a: 'hall', b: 'security', kind: 'door', locked: true },
    ],
    rooms: {
      cellA: {
        name: '감금실 A', rect: [0, 0, 3, 3],
        desc: '형광등이 깜빡이는 좁은 방. 벽시계 하나와 사물함이 있다.',
        objects: [
          {
            id: 'clockA', name: '멈춘 벽시계', icon: '🕰️',
            desc: '시계가 3시 17분에서 멈춰 있다. 초침만 미세하게 떨린다.',
            bonus: '유리에 손톱으로 "기억해"라고 긁어 놓았다.',
          },
          {
            id: 'bedA', name: '철제 침대', icon: '🛏️',
            desc: '매트리스 아래 쪽지: "시간은 멈춰도 답은 남는다."',
            bonus: '쪽지 뒷면에 작게 "시 → 분, 4자리".',
          },
          {
            id: 'lockerA', name: '자물쇠 사물함', icon: '🔒',
            desc: '4자리 숫자 자물쇠가 걸려 있다.',
            lock: { answer: '0317', prompt: '4자리 숫자를 입력하세요.', hint: '이 방에서 "멈춘" 것은?', forceable: true },
            onSolve: { text: '철컥! 사물함 안에 카드키가 있다.', item: 'keycard' },
            solvedDesc: '텅 빈 사물함.',
          },
          {
            id: 'doorA', name: '철문', icon: '🚪',
            desc: '카드 리더기가 달린 철문. 바깥쪽에 빗장 걸리는 소리가 났었다.',
            needItem: 'keycard', lackText: '리더기가 붉게 빛난다. 카드키가 필요하다.',
            onSolve: { text: '삑— 초록불과 함께 철문이 열린다!', unlock: 'dA' },
            solvedDesc: '열린 철문. 복도로 이어진다.',
          },
        ],
      },
      cellB: {
        name: '감금실 B', rect: [3, 0, 3, 3],
        desc: '벽면이 온통 낙서로 뒤덮인 방. 구석에 화이트보드가 기대어 있다.',
        objects: [
          {
            id: 'graffiti', name: '벽 낙서', icon: '✍️',
            desc: '알아볼 수 없는 낙서 사이 또렷한 글씨: "보안실 비번 0915 — 잊지 마."',
            bonus: '낙서 중 일부는 손톱으로 새겼다. 여기 갇혔던 사람이 또 있었던 걸까.',
          },
          {
            id: 'boardB', name: '화이트보드', icon: '📋',
            desc: '수식 사이 빨간 동그라미 친 글자 넷: E · X · I · T. 화살표가 문을 가리킨다.',
          },
          {
            id: 'doorB', name: '다이얼 철문', icon: '🚪',
            desc: '알파벳 4글자 다이얼 자물쇠가 달린 문.',
            lock: { answer: 'EXIT', prompt: '알파벳 4글자를 입력하세요.', hint: '화이트보드를 보자.', forceable: true },
            onSolve: { text: '다이얼이 맞물리며 문이 열린다!', unlock: 'dB' },
            solvedDesc: '열린 철문. 복도로 이어진다.',
          },
        ],
      },
      cellC: {
        name: '감금실 C', rect: [6, 0, 3, 3],
        desc: '불이 거의 들어오지 않는 방. 깨진 거울이 걸려 있다.',
        objects: [
          {
            id: 'bedC', name: '삐걱이는 침대', icon: '🛏️',
            desc: '침대 프레임 나사 하나가 헐겁다.',
            onSolve: { text: '프레임 틈에 일자 드라이버가 끼워져 있었다!', item: 'screwdriver' },
            solvedDesc: '나사가 빠진 침대 프레임.',
          },
          {
            id: 'mirror', name: '깨진 거울', icon: '🪞',
            desc: '거울 뒷면에 메모: "엘리베이터는 전원이 있어야 움직인다."',
            bonus: '거울 조각에 비친 천장 구석에 작은 카메라가 있다. 누군가 보고 있다.',
          },
          {
            id: 'doorC', name: '경첩 철문', icon: '🚪',
            desc: '잠금장치는 단단하지만, 안쪽으로 드러난 경첩 나사가 보인다.',
            needItem: 'screwdriver', lackText: '맨손으로는 경첩 나사를 풀 수 없다.',
            onSolve: { text: '드라이버로 경첩을 풀자 문짝이 덜컹 떨어져 나간다!', unlock: 'dC' },
            solvedDesc: '문짝이 떨어져 나간 입구.',
          },
        ],
      },
      lift: {
        name: '엘리베이터', rect: [9, 0, 3, 3],
        desc: '낡은 화물 엘리베이터. 층 버튼 대신 숫자 키패드만 있다.',
        objects: [
          {
            id: 'keypad', name: '최종 키패드', icon: '🔢',
            desc: '화면에 "최종 인증 코드 입력 — 전원 탑승 확인"이 깜빡인다.',
            needAll: true,
            lock: { answer: '1441', prompt: '최종 인증 코드(4자리)를 입력하세요.', hint: '감금실 A 시계 + 딸의 생일.' },
            onSolve: { text: '인증 완료. 엘리베이터가 덜컹이며 위로 올라간다…', ending: 'escape' },
          },
        ],
      },
      hall: {
        name: '복도', rect: [0, 3, 12, 2],
        desc: '감금실 문들이 늘어선 긴 복도. 문마다 바깥쪽에 빗장이 걸려 있다. 벽에 비상 전원 패널이 있다.',
        objects: [
          {
            id: 'barA', name: 'A 문 빗장', icon: '🪵', desc: '감금실 A 문에 걸린 빗장.',
            onSolve: { text: '빗장을 들어 올리자 감금실 A 문이 열린다.', unlock: 'dA' },
          },
          {
            id: 'barB', name: 'B 문 빗장', icon: '🪵', desc: '감금실 B 문에 걸린 빗장.',
            onSolve: { text: '빗장을 들어 올리자 감금실 B 문이 열린다.', unlock: 'dB' },
          },
          {
            id: 'barC', name: 'C 문 빗장', icon: '🪵', desc: '감금실 C 문에 걸린 빗장.',
            onSolve: { text: '빗장을 들어 올리자 감금실 C 문이 열린다.', unlock: 'dC' },
          },
          {
            id: 'secLock', name: '보안실 도어락', icon: '🔐',
            desc: '보안실 문에 달린 숫자 도어락.',
            lock: { answer: '0915', prompt: '4자리 비밀번호를 입력하세요.', hint: '누군가 벽에 적어 두지 않았을까?' },
            onSolve: { text: '띠리릭— 보안실 문이 열렸다.', unlock: 'dS' },
          },
          {
            id: 'panel', name: '비상 전원 패널', icon: '⚡',
            desc: '퓨즈 소켓 하나가 비어 있고, 옆에 숫자 키패드가 있다.',
            needItem: 'fuse', lackText: '퓨즈 소켓이 비어 있다. 이대로는 작동하지 않는다.',
            lock: { answer: '1124', prompt: '퓨즈를 꽂자 화면이 켜졌다. 비상 전원 암호(4자리)를 입력하세요.', hint: '박사가 잊지 않으려 한 날짜.' },
            onSolve: { text: '윙— 전원이 들어오고 엘리베이터 문이 열린다!', unlock: 'dL' },
            solvedDesc: '전원 패널이 초록색으로 빛난다.',
          },
        ],
      },
      lab: {
        name: '연구실', rect: [0, 5, 6, 4],
        desc: '서류가 어지럽게 흩어진 연구실. 철제 캐비닛이 굳게 잠겨 있다.',
        objects: [
          {
            id: 'journal', name: '연구 일지', icon: '📓',
            desc: '"비상 전원 암호는 우리 딸 생일로 해 두었다. 이번엔 잊지 말자." — 박사 K',
            bonus: '마지막 장이 찢겨 있다. 누군가 서둘러 떠난 것 같다.',
          },
          {
            id: 'photo', name: '책상 위 액자', icon: '🖼️',
            desc: '박사와 어린 소녀의 사진. 뒷면에 "지수 첫 생일 — 11월 24일".',
          },
          {
            id: 'cabinet', name: '철제 캐비닛', icon: '🗄️',
            desc: '작은 열쇠 구멍이 있는 캐비닛.',
            needItem: 'key', lackText: '열쇠가 필요하다.',
            onSolve: { text: '열쇠가 딸깍 돌아간다. 안에서 예비 퓨즈를 찾았다!', item: 'fuse' },
            solvedDesc: '열린 캐비닛. 서류 뭉치뿐이다.',
          },
        ],
      },
      security: {
        name: '보안실', rect: [6, 5, 6, 4],
        desc: '모니터 수십 대가 깜빡이는 보안실.',
        objects: [
          { id: 'cctv', name: 'CCTV 모니터', icon: '🖥️', desc: '시설 곳곳의 화면이 나온다.', cctv: true },
          {
            id: 'keybox', name: '열쇠함', icon: '🧰',
            desc: '벽에 걸린 열쇠함. 대부분 비었지만 하나가 남아 있다.',
            onSolve: { text: '"연구실" 이름표가 붙은 작은 열쇠를 챙겼다.', item: 'key' },
            solvedDesc: '텅 빈 열쇠함.',
          },
          {
            id: 'memo', name: '보안 메모', icon: '📝',
            desc: '"최종 코드 = 처음 깨어난 곳의 시간 + 잊지 말아야 할 날 (전원 탑승 필수)"',
            bonus: '누군가 연필로 "더하기!!"에 밑줄을 쳐 두었다.',
          },
        ],
      },
    },
  },
];
