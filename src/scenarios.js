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
//   needItem    조사하는 멤버가 갖고 있어야 하는 아이템 id (쓰면 없어진다. keepItem: true 면 남는다)
//   needAll     모든 멤버가 이 구역에 모여 있어야 함
//   lock        { answer, prompt, hint, forceable }  정답 입력 퍼즐
//   onSolve     { text, item, unlock, ending }  해결 결과 (unlock: 링크 id)
//   solvedDesc  해결 후 다시 조사했을 때 설명
//   cctv        조사하면 모든 멤버의 위치를 알려 준다
//   shared      true 면 여러 캐릭터가 살펴볼 수 있다 (기본: 단서 물건은 처음 만진 캐릭터만)
//
// 자동 이벤트 events: 조건이 맞으면 진행자 없이도 연출이 나온다. 기본은 한 번만, repeat: true 면 반복.
//   on: 'start'                         게임 시작
//       'enter'   room: 구역 id         누군가 그 구역에 들어감 (처음 한 번)
//       'inspect' obj: 오브젝트 id      그 물건을 조사함
//       'solve'   obj: 오브젝트 id      그 퍼즐을 풂
//       'item'    item: 아이템 id       그 아이템을 얻음
//       'together' count: 'all' | 숫자  한 구역에 그만큼 모임 (room 으로 구역 지정 가능)
//       'time'    elapsed: 초           시작하고 그만큼 지남
//                 left: 초              남은 시간이 그만큼 됨 (방장이 제한 시간을 켰을 때만)
//       'idle'    seconds: 초           그동안 아무 퍼즐도 못 풂
//   if: { done: [...], notDone: [...] } 오브젝트나 링크가 해결됐는지 추가 조건
//   do: 연출 목록. to: 'here'(조건이 일어난 구역, 기본) / 'all'(전체) / 구역 id
//       { narr: '나레이션' }  { sys: '알림' }  { voice: '대사', speaker: '천장 스피커' }
//       { effect: 'flicker' | 'blackout' | 'alarm' }  화면 효과
//       { unlock: 링크 id }  문을 연다
//       { lock: 링크 id }    문을 강제로 잠근다 → { release: 링크 id } 로 원래 상태로 돌린다 (순찰 연출 등)
//       { time: +60 | -60 }  제한 시간을 켰을 때만 남은 시간을 늘리거나 줄인다
//       { hint: true | '머리말' }  자동 힌트를 켰을 때만
//       { gameover: '문구' }  그 자리에서 탈출 실패로 끝낸다
//       { attack: { id, seconds, label, until, success: [연출], fail: [연출] } }  타임어택
//         until: { done: 오브젝트·링크 id } / { allIn: 구역 id } / { noneIn: 구역 id }
//         to 가 구역이면 그 구역에 있던 캐릭터만, 'all' 이면 모두가 대상. 대상의 화면에 남은 시간이 뜬다.
//         fail 안에서 { moveTo: 구역 id } 를 쓰면 대상 캐릭터를 그 구역으로 끌고 간다.
// epilogue  탈출에 성공하면 엔딩 화면에 보여 주는 진상 (문단 목록). 실패하면 "진상 보기"를 눌러야 보인다.
// timeLimit 은 방장이 대기실에서 "제한 시간"을 켰을 때만 쓰인다. 기본은 제한 시간 없음.
//   문구 안의 {name} 은 조건을 일으킨 캐릭터 이름, {room} 은 그 구역 이름으로 바뀐다.
export const SCENARIOS = [
  {
    id: 'bunker',
    title: '제1화 · 지하 연구소',
    summary: '멤버들은 서로 다른 감금실에서 눈을 뜬다. 흩어진 동료와 목소리로 협력해 지상으로 탈출하라.',
    timeLimit: 30 * 60,
    failText: '시간 초과. 시설이 완전히 봉쇄되었다…',
    epilogue: [
      '이곳은 \"기억 보존 연구소\"였다. 사람의 기억을 기계에 옮겨 담는 연구를 하던 곳.',
      '연구를 이끈 박사 K에게는 딸 지수가 있었다. 지수는 첫 생일을 몇 해 넘기지 못하고 병으로 세상을 떠났다. 박사는 딸에 대한 기억이 흐려지는 것을 견딜 수 없었다.',
      '그래서 그는 다른 사람의 기억을 빌리기로 했다. 감금실의 \"피험자\"들에게 지수의 기억을 덮어씌우는 실험. 벽의 날짜 선과 손톱 낙서는 앞선 피험자들이 남긴 것이다. \"기억해.\"',
      '천장 스피커의 목소리는 실험을 감시하던 시스템이었다. 비상 전원이 켜지자 봉쇄 절차가 시작된 것도, 실험이 실패하면 시설째 묻어 버리도록 박사가 설계해 두었기 때문이다.',
      '박사가 비상 전원 암호를 딸의 생일로, 최종 코드를 \"잊지 말아야 할 날\"로 정한 건 우연이 아니었다. 이 문을 여는 사람만은 지수를 기억해 주기를 바랐던 것이다.',
      '지상으로 나온 멤버들의 주머니에는 각자 서명한 실험 동의서가 한 장씩 들어 있었다. 이름은 분명 자기 글씨였다. 그런데 서명한 기억은, 어디에도 없다.',
    ],
    map: { w: 12, h: 9 },
    starts: ['cellA', 'cellB', 'cellC'],
    intro: [
      '삐— 삐— 삐—',
      '희미한 경보음. 차가운 콘크리트 바닥 위에서 멤버들이 각자 눈을 뜬다.',
      '옆에 있어야 할 동료들이 보이지 않는다. 벽 너머에서 누군가의 기척이 느껴진다.',
      '천장 스피커가 지직거린다. "…곧 이 시설은 완전히 봉쇄된다. 전원, 그 전에 나가라."',
    ],
    items: {
      keycard: { name: '카드키', icon: 'card' },
      screwdriver: { name: '드라이버', icon: 'screwdriver' },
      key: { name: '작은 열쇠', icon: 'key' },
      fuse: { name: '예비 퓨즈', icon: 'fuse' },
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
    events: [
      { id: 'start-pa', on: 'start', do: [{ voice: '…녹화 장치 정상 작동. 피험자 전원 의식 확인.', speaker: '천장 스피커', to: 'all' }] },
      {
        id: 'mirror', on: 'inspect', obj: 'mirror',
        do: [{ effect: 'flicker' }, { narr: '거울 속, {name}의 등 뒤로 무언가가 스쳐 지나간 것 같다. 돌아보면… 아무도 없다.' }],
      },
      {
        id: 'hall-first', on: 'enter', room: 'hall',
        do: [{ effect: 'flicker' }, { voice: '…생각보다 빨리 나왔군. 다른 방의 친구들도 꺼내 줄 건가?', speaker: '복도 스피커' }],
      },
      { id: 'lab-first', on: 'enter', room: 'lab', do: [{ narr: '연구실 바닥에 무언가를 질질 끈 자국이 캐비닛까지 이어져 있다.' }] },
      {
        id: 'security-first', on: 'enter', room: 'security',
        do: [{ narr: '모니터 하나에 지금 이 방이 비치고 있다. 화면 속 {name}의 뒤에… 누군가 서 있다. 다시 보니 그냥 노이즈다.' }, { effect: 'flicker' }],
      },
      { id: 'reunion', on: 'together', count: 'all', do: [{ narr: '흩어졌던 멤버들이 한자리에 모였다. 서로의 얼굴을 보자 조금은 숨이 쉬어진다.' }] },
      {
        id: 'power-on', on: 'solve', obj: 'panel',
        do: [
          { effect: 'flicker', to: 'all' },
          { voice: '비상 전원 가동. 엘리베이터를 호출합니다. 경고 — 비상 전원 감지, 봉쇄 절차를 시작합니다.', speaker: '안내 방송', to: 'all' },
          {
            to: 'all',
            attack: {
              id: 'lockdown', seconds: 240, label: '봉쇄문이 닫히기 전에 모두 엘리베이터로',
              until: { allIn: 'lift' },
              success: [{ narr: '모두 엘리베이터에 올라탄 순간, 등 뒤에서 봉쇄문이 쾅 닫힌다.', to: 'all' }],
              fail: [{ gameover: '봉쇄문이 닫혔다. 엘리베이터에 닿지 못한 채 시설이 완전히 봉쇄되었다…' }],
            },
          },
        ],
      },
      { id: 'lift-first', on: 'enter', room: 'lift', do: [{ narr: '엘리베이터 벽에 긁힌 글씨: "전부 같이 타. 혼자 올라가면 문이 안 열려."' }] },
      { id: 't10', on: 'time', left: 600, do: [{ voice: '봉쇄까지 10분.', speaker: '안내 방송', to: 'all' }, { effect: 'alarm', to: 'all' }] },
      {
        id: 't5', on: 'time', left: 300,
        do: [{ effect: 'blackout', to: 'all' }, { narr: '모든 불이 꺼졌다. 몇 초 뒤 붉은 비상등이 들어온다. 어딘가에서 철문이 닫히는 소리가 울린다.', to: 'all' }],
      },
      { id: 't1', on: 'time', left: 60, do: [{ voice: '60초.', speaker: '안내 방송', to: 'all' }, { effect: 'alarm', to: 'all' }] },
      {
        id: 'idle', on: 'idle', seconds: 300, repeat: true,
        do: [{ voice: '…막혔나? 조금만 도와주지.', speaker: '천장 스피커', to: 'all' }, { hint: '자동 힌트' }],
      },
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
            id: 'clockA', name: '멈춘 벽시계', icon: 'clock',
            desc: '시계가 3시 17분에서 멈춰 있다. 초침만 미세하게 떨린다.',
            bonus: '유리에 손톱으로 "기억해"라고 긁어 놓았다.',
          },
          {
            id: 'bedA', name: '철제 침대', icon: 'bed',
            desc: '매트리스 아래 쪽지: "시간은 멈춰도 답은 남는다."',
            bonus: '쪽지 뒷면에 작게 "시 → 분, 4자리".',
          },
          {
            id: 'lockerA', name: '자물쇠 사물함', icon: 'padlock',
            desc: '4자리 숫자 자물쇠가 걸려 있다.',
            lock: { answer: '0317', prompt: '4자리 숫자를 입력하세요.', hint: '이 방에서 "멈춘" 것은?', forceable: true },
            onSolve: { text: '철컥! 사물함 안에 카드키가 있다.', item: 'keycard' },
            solvedDesc: '텅 빈 사물함.',
          },
          {
            id: 'doorA', name: '철문', icon: 'door',
            desc: '카드 리더기가 달린 철문. 바깥쪽에 빗장 걸리는 소리가 났었다.',
            needItem: 'keycard', lackText: '리더기가 붉게 빛난다. 카드키가 필요하다.',
            onSolve: { text: '삑— 초록불과 함께 철문이 열린다!', unlock: 'dA' },
            solvedDesc: '열린 철문. 복도로 이어진다.',
          },
        ],
      },
      cellB: {
        name: '감금실 B', rect: [3, 0, 3, 3],
        desc: '벽면에 날짜를 센 듯한 붉은 선이 빼곡하다. 구석에 화이트보드가 기대어 있다.',
        objects: [
          {
            id: 'graffiti', name: '벽 낙서', icon: 'graffiti',
            desc: '누군가 날을 세며 그어 놓은 붉은 선들. 그 아래 또렷한 글씨: "보안실 비번 0915 — 잊지 마."',
            bonus: '낙서 중 일부는 손톱으로 새겼다. 여기 갇혔던 사람이 또 있었던 걸까.',
          },
          {
            id: 'boardB', name: '화이트보드', icon: 'board',
            desc: '수식 사이 빨간 동그라미 친 글자 넷: E · X · I · T. 화살표가 문을 가리킨다.',
          },
          {
            id: 'doorB', name: '다이얼 철문', icon: 'door',
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
            id: 'bedC', name: '삐걱이는 침대', icon: 'bed',
            desc: '침대 프레임 나사 하나가 헐겁다.',
            onSolve: { text: '프레임 틈에 일자 드라이버가 끼워져 있었다!', item: 'screwdriver' },
            solvedDesc: '나사가 빠진 침대 프레임.',
          },
          {
            id: 'mirror', name: '깨진 거울', icon: 'mirror',
            desc: '거울 뒷면에 메모: "엘리베이터는 전원이 있어야 움직인다."',
            bonus: '거울 조각에 비친 천장 구석에 작은 카메라가 있다. 누군가 보고 있다.',
          },
          {
            id: 'doorC', name: '경첩 철문', icon: 'door',
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
            id: 'keypad', name: '최종 키패드', icon: 'keypad',
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
            id: 'barA', name: 'A 문 빗장', icon: 'plank', desc: '감금실 A 문에 걸린 빗장.',
            onSolve: { text: '빗장을 들어 올리자 감금실 A 문이 열린다.', unlock: 'dA' },
          },
          {
            id: 'barB', name: 'B 문 빗장', icon: 'plank', desc: '감금실 B 문에 걸린 빗장.',
            onSolve: { text: '빗장을 들어 올리자 감금실 B 문이 열린다.', unlock: 'dB' },
          },
          {
            id: 'barC', name: 'C 문 빗장', icon: 'plank', desc: '감금실 C 문에 걸린 빗장.',
            onSolve: { text: '빗장을 들어 올리자 감금실 C 문이 열린다.', unlock: 'dC' },
          },
          {
            id: 'secLock', name: '보안실 도어락', icon: 'doorlock',
            desc: '보안실 문에 달린 숫자 도어락.',
            lock: { answer: '0915', prompt: '4자리 비밀번호를 입력하세요.', hint: '누군가 벽에 적어 두지 않았을까?' },
            onSolve: { text: '띠리릭— 보안실 문이 열렸다.', unlock: 'dS' },
          },
          {
            id: 'panel', name: '비상 전원 패널', icon: 'power',
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
            id: 'journal', name: '연구 일지', icon: 'book',
            desc: '"비상 전원 암호는 우리 딸 생일로 해 두었다. 이번엔 잊지 말자." — 박사 K',
            bonus: '마지막 장이 찢겨 있다. 누군가 서둘러 떠난 것 같다.',
          },
          {
            id: 'photo', name: '책상 위 액자', icon: 'frame',
            desc: '박사와 어린 소녀의 사진. 뒷면에 "지수 첫 생일 — 11월 24일".',
          },
          {
            id: 'cabinet', name: '철제 캐비닛', icon: 'cabinet',
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
          { id: 'cctv', name: 'CCTV 모니터', icon: 'monitor', desc: '시설 곳곳의 화면이 나온다.', cctv: true },
          {
            id: 'keybox', name: '열쇠함', icon: 'keybox',
            desc: '벽에 걸린 열쇠함. 대부분 비었지만 하나가 남아 있다.',
            onSolve: { text: '"연구실" 이름표가 붙은 작은 열쇠를 챙겼다.', item: 'key' },
            solvedDesc: '텅 빈 열쇠함.',
          },
          {
            id: 'memo', name: '보안 메모', icon: 'note',
            desc: '"최종 코드 = 처음 깨어난 곳의 시간 + 잊지 말아야 할 날 (전원 탑승 필수)"',
            bonus: '누군가 연필로 "더하기!!"에 밑줄을 쳐 두었다.',
          },
        ],
      },
    },
  },

  {
    id: 'hospital',
    title: '제2화 · 폐병원 7병동',
    summary: '문 닫은 지 20년 된 병원의 7병동. 병실에 갇힌 멤버들은 소등 전에 비상계단으로 내려가야 한다. 그리고 이곳엔 아직 누군가 남아 있다.',
    timeLimit: 35 * 60,
    failText: '소등 시간이 되었다. 7병동의 문이 모두 잠겼다…',
    epilogue: [
      '20년 전, 이 병원의 7병동은 서류에 없는 병동이었다. 원장은 그곳에서 갈 곳 없는 환자들을 상대로 허가받지 않은 치료를 했다.',
      '이수아는 그 병동의 가장 어린 환자였다. 3월 14일에 입원한 B형의 여자아이. 차트의 마지막 줄 \"퇴원 불가\"는 병명이 아니라 원장의 지시였다.',
      '병원이 문을 닫던 날 밤, 원장은 기록을 없애려고 7병동을 잠그고 떠났다. 소등된 병동에 남겨진 수아는 끝내 아무도 데리러 오지 않는 문을 바라보며 기다렸다.',
      '그 뒤로 7병동에 들어온 사람은 누구도 나가지 못했다. 수아가 붙잡은 게 아니었다. 혼자 남는 게 무서워서, \"언니\"들이 떠나지 않기를 바랐을 뿐이다.',
      '원장 일지의 마지막 문장은 사실이었다. 모두가 함께 계단을 내려갈 때, 수아도 처음으로 7병동의 문턱을 넘을 수 있었다.',
      '며칠 뒤, 폐병원 철거 현장에서 원장의 진료 기록이 무더기로 발견되었다는 짧은 기사가 났다. 기사 사진 속 7병동 계단참에는, 작은 신발 한 켤레가 가지런히 놓여 있었다.',
    ],
    map: { w: 12, h: 9 },
    starts: ['ward704', 'ward705'],
    intro: [
      '똑… 똑… 링거액 떨어지는 소리에 눈을 뜬다.',
      '누렇게 바랜 병원 시트. 손목에는 이름 대신 숫자가 적힌 환자 팔찌가 채워져 있다.',
      '복도 쪽에서 바퀴 달린 무언가가 천천히 굴러가는 소리가 난다.',
      '"…환자 여러분. 소등 시간까지 병실을 나가지 마십시오."',
    ],
    items: {
      hairpin: { name: '녹슨 머리핀', icon: 'hairpin' },
      card: { name: '처치실 출입카드', icon: 'card' },
      masterkey: { name: '마스터키', icon: 'key' },
    },
    hints: [
      { until: 'd704', text: '704호 — 베개 속에 문을 딸 도구가 있다.' },
      { until: 'd705', text: '705호 — 호출 버튼 메모대로, 이 방 번호를 거꾸로.' },
      { until: 'desk', text: '간호사실 책상 서랍을 열어 보자.' },
      { until: 'dT', text: '출입카드로 처치실 문을 연다.' },
      { until: 'dO', text: '원장실 비밀번호는 704호 차트의 입원일. 3월 14일 → 0314.' },
      { until: 'safe', text: '704호 차트의 혈액형을 처치실 냉장고에서 찾자.' },
      { until: 'dS', text: '마스터키로 복도 끝 비상구 문을 연다.' },
      { until: 'downstairs', text: '모두 비상계단에 모인 뒤 계단을 내려가자.' },
    ],
    links: [
      { id: 'w45', a: 'ward704', b: 'ward705', kind: 'wall' },
      { id: 'w5n', a: 'ward705', b: 'nurse', kind: 'wall' },
      { id: 'd704', a: 'ward704', b: 'corridor', kind: 'door', locked: true },
      { id: 'd705', a: 'ward705', b: 'corridor', kind: 'door', locked: true },
      { id: 'dN', a: 'nurse', b: 'corridor', kind: 'open' },
      { id: 'dT', a: 'corridor', b: 'treat', kind: 'door', locked: true },
      { id: 'dO', a: 'corridor', b: 'office', kind: 'door', locked: true },
      { id: 'dS', a: 'corridor', b: 'stairs', kind: 'door', locked: true },
      { id: 'wTO', a: 'treat', b: 'office', kind: 'wall' },
      { id: 'wOS', a: 'office', b: 'stairs', kind: 'wall' },
    ],
    rooms: {
      ward704: {
        name: '704호 병실', rect: [0, 0, 4, 4],
        desc: '침대 하나와 링거 거치대 하나. 침대 시트에 누군가 누워 있던 자국이 아직 따뜻하다.',
        objects: [
          {
            id: 'chart704', name: '환자 차트', icon: 'clipboard',
            desc: '"환자명 이수아 / 혈액형 B / 입원일 3월 14일 / 담당: 원장" 마지막 줄은 볼펜으로 거칠게 지워져 있다.',
            bonus: '지워진 줄을 빛에 비춰 보니: "퇴원 불가".',
          },
          {
            id: 'pillow', name: '불룩한 베개', icon: 'bed',
            desc: '베개 속에 딱딱한 것이 만져진다.',
            onSolve: { text: '베개 속에서 녹슨 머리핀이 나왔다.', item: 'hairpin' },
            solvedDesc: '속이 빈 베개.',
          },
          {
            id: 'door704', name: '병실 문', icon: 'door',
            desc: '낡은 원통형 자물쇠가 달린 문. 누군가 바깥에서 잠갔다.',
            needItem: 'hairpin', lackText: '열쇠 구멍이 작다. 가늘고 단단한 것이 있으면 딸 수 있을 것 같다.',
            onSolve: { text: '머리핀을 구부려 자물쇠를 따자 딸깍, 문이 열린다.', unlock: 'd704' },
            solvedDesc: '열린 문. 복도로 이어진다.',
          },
        ],
      },
      ward705: {
        name: '705호 병실', rect: [4, 0, 4, 4],
        desc: '텔레비전이 혼자 지직거리는 병실. 벽에 오래된 달력이 걸려 있다.',
        objects: [
          {
            id: 'tv705', name: '지직거리는 TV', icon: 'tv',
            desc: '화면에 노이즈만 흐른다. 가끔 "7…층…" 하는 소리가 섞인다.',
            bonus: '노이즈 사이로 잠깐, 옆방 704호의 빈 침대가 비친다.',
          },
          {
            id: 'calendar', name: '오래된 달력', icon: 'note',
            desc: '20년 전 3월 달력. 14일에 빨간 동그라미와 "수아 입원" 메모.',
          },
          {
            id: 'callmemo', name: '호출 버튼 메모', icon: 'note',
            desc: '간호사 호출 버튼 옆에 붙은 메모: "문 비밀번호 = 이 방 번호를 거꾸로. 환자들이 못 외우게."',
          },
          {
            id: 'door705', name: '번호키 병실 문', icon: 'doorlock',
            desc: '3자리 번호키가 달린 문.',
            lock: { answer: '507', prompt: '3자리 숫자를 입력하세요.', hint: '이 방 번호를 거꾸로.', forceable: true },
            onSolve: { text: '삑삑— 번호키가 풀렸다.', unlock: 'd705' },
            solvedDesc: '열린 문. 복도로 이어진다.',
          },
        ],
      },
      nurse: {
        name: '간호사실', rect: [8, 0, 4, 4],
        desc: '서류가 흩어진 간호사실. 관찰창 너머로 705호가 보이고, 책상 위 구내전화가 울리다 말다 한다.',
        objects: [
          { id: 'phone', name: '구내전화', icon: 'phone', desc: '수화기를 들자 지지직거리는 소리만 들린다.' },
          {
            id: 'desk', name: '간호사 책상', icon: 'cabinet',
            desc: '서랍 하나가 반쯤 열려 있다.',
            onSolve: { text: '서랍 안쪽에서 "처치실" 출입카드를 찾았다.', item: 'card' },
            solvedDesc: '텅 빈 서랍.',
          },
          {
            id: 'roster', name: '근무표 보드', icon: 'board',
            desc: '당직표. 맨 아래에 누군가 덧써 놓았다: "원장실 비번 = 그 아이가 들어온 날 (4자리)".',
          },
          {
            id: 'window', name: '관찰창', icon: 'mirror',
            desc: '유리창 너머로 705호 병실이 보인다. 유리가 얇아 저쪽 소리가 웅얼웅얼 넘어온다.',
            bonus: '유리에 작은 손바닥 자국이 안쪽에서 찍혀 있다.',
          },
        ],
      },
      corridor: {
        name: '7병동 복도', rect: [0, 4, 12, 2],
        desc: '깜빡이는 형광등 아래 긴 복도. 병실 문마다 바깥 잠금쇠가 있고, 끝에 녹색 비상구 표시가 희미하게 빛난다.',
        objects: [
          {
            id: 'lock704', name: '704호 잠금쇠', icon: 'plank', desc: '704호 문 바깥에 걸린 잠금쇠.',
            onSolve: { text: '잠금쇠를 젖히자 704호 문이 열린다.', unlock: 'd704' },
          },
          {
            id: 'lock705', name: '705호 잠금쇠', icon: 'plank', desc: '705호 문 바깥에 걸린 잠금쇠.',
            onSolve: { text: '잠금쇠를 젖히자 705호 문이 열린다.', unlock: 'd705' },
          },
          {
            id: 'treatDoor', name: '처치실 문', icon: 'doorlock',
            desc: '카드 리더기가 달린 처치실 문.',
            needItem: 'card', lackText: '카드 리더기가 붉게 깜빡인다. 출입카드가 필요하다.',
            onSolve: { text: '삑— 처치실 문이 열렸다.', unlock: 'dT' },
          },
          {
            id: 'officeDoor', name: '원장실 도어락', icon: 'doorlock',
            desc: '원장실 문에 달린 4자리 도어락.',
            lock: { answer: '0314', prompt: '4자리 비밀번호를 입력하세요.', hint: '그 아이가 입원한 날.' },
            onSolve: { text: '철컥— 원장실 문이 열린다.', unlock: 'dO' },
          },
          {
            id: 'exitDoor', name: '비상구 문', icon: 'exit',
            desc: '녹색 비상구 표시 아래 철문.',
            needItem: 'masterkey', lackText: '굵은 자물쇠가 채워져 있다. 마스터키가 필요하다.',
            onSolve: { text: '마스터키가 돌아가고 비상구 문이 삐걱 열린다.', unlock: 'dS' },
            solvedDesc: '열린 비상구. 계단으로 이어진다.',
          },
        ],
      },
      treat: {
        name: '처치실', rect: [0, 6, 4, 3],
        desc: '소독약 냄새가 코를 찌르는 처치실. 혈액 냉장고가 웅웅거린다.',
        objects: [
          {
            id: 'fridge', name: '혈액 냉장고', icon: 'bloodbag',
            desc: '혈액 팩마다 혈액형과 숫자가 적혀 있다. A형 4412 / O형 7720 / AB형 3051 / B형 1987.',
            bonus: 'B형 팩에만 "수아"라는 이름표가 붙어 있다.',
          },
          { id: 'xray', name: '엑스레이 판독기', icon: 'monitor', desc: '어린아이의 흉부 사진. 구석에 "이수아, 3/14"라고 적혀 있다.' },
          { id: 'tray', name: '수술 트레이', icon: 'note', desc: '녹슨 기구들이 가지런히 놓여 있다. 자리 하나가 비어 있다.' },
        ],
      },
      office: {
        name: '원장실', rect: [4, 6, 4, 3],
        desc: '두꺼운 커튼이 쳐진 원장실. 벽에 금고가 박혀 있다.',
        objects: [
          {
            id: 'safe', name: '벽 금고', icon: 'safe',
            desc: '4자리 다이얼 금고.',
            lock: { answer: '1987', prompt: '4자리 숫자를 입력하세요.', hint: '그 아이의 혈액 팩에 적힌 숫자.' },
            onSolve: { text: '금고 안에 마스터키와 빛바랜 사진 한 장이 들어 있다.', item: 'masterkey' },
            solvedDesc: '열린 금고. 사진 속 아이가 웃고 있다.',
          },
          {
            id: 'diary', name: '원장 일지', icon: 'book',
            desc: '"수아는 아직 7층에 있다. 그 아이를 두고 나가는 사람은… 아무도 없어야 한다."',
            bonus: '마지막 장: "모두 함께 내려가면, 그 아이도 따라 나갈 수 있을지 모른다."',
          },
          { id: 'portrait', name: '원장 사진', icon: 'frame', desc: '흰 가운을 입은 원장. 눈 부분만 칼로 긁혀 있다.' },
        ],
      },
      stairs: {
        name: '비상계단', rect: [8, 6, 4, 3],
        desc: '아래로 이어지는 비상계단. 한 층 아래에서 바깥 공기 냄새가 올라온다.',
        objects: [
          {
            id: 'downstairs', name: '계단 아래로', icon: 'exit',
            desc: '한 걸음만 내려가면 6층이다.',
            needAll: true,
            onSolve: { text: '모두 함께 계단을 내려간다. 등 뒤에서 작은 발소리가 따라오다가… 문턱에서 멈춘다. "고마워, 언니들."', ending: 'escape' },
          },
        ],
      },
    },
    events: [
      { id: 'start-pa', on: 'start', do: [{ voice: '…환자 여러분, 기상 시간입니다. 오늘도 7병동을 나가실 수 없습니다.', speaker: '원내 방송', to: 'all' }] },
      {
        id: 'phone', on: 'inspect', obj: 'phone',
        do: [{ effect: 'flicker' }, { voice: '…언니야… 나 여기 있어… 같이 나가자…', speaker: '수화기 너머' }],
      },
      {
        id: 'corridor-first', on: 'enter', room: 'corridor',
        do: [{ effect: 'flicker' }, { narr: '복도 저편부터 형광등이 하나씩 꺼지며 다가오다가, {name} 바로 앞에서 멈춘다.' }],
      },
      {
        id: 'treat-first', on: 'enter', room: 'treat',
        do: [{ effect: 'blackout' }, { narr: '문이 열리는 순간 불이 나갔다가 한참 뒤에야 다시 들어온다. 침대 시트가 사람 모양으로 꺼져 있다.' }],
      },
      { id: 'office-first', on: 'enter', room: 'office', do: [{ narr: '바람 한 점 없는데 원장실 커튼이 천천히 흔들린다.' }] },
      {
        id: 'safe-open', on: 'solve', obj: 'safe',
        do: [
          { effect: 'alarm', to: 'all' },
          { voice: '원장님, 7병동 환자들이 금고를 열었습니다. 즉시—', speaker: '원내 방송', to: 'all' },
          { narr: '방송이 뚝 끊겼다. 아래층 어딘가에서 엘리베이터가 올라오는 소리가 난다.', to: 'all' },
          {
            to: 'all',
            attack: {
              id: 'director', seconds: 180, label: '누군가 올라온다! 모두 비상계단으로',
              until: { allIn: 'stairs' },
              success: [{ narr: '비상계단 문을 닫자, 복도에서 또각거리던 구두 소리가 문 앞에서 멈춘다.', to: 'all' }],
              fail: [{ gameover: '엘리베이터 문이 열리고, 흰 가운이 복도에 들어섰다. 아무도 7병동을 나가지 못했다…' }],
            },
          },
        ],
      },
      { id: 'reunion', on: 'together', count: 'all', do: [{ narr: '모두 모였다. 어디선가 아이의 웃음소리가 아주 작게 들린다.' }] },
      { id: 'stairs-first', on: 'enter', room: 'stairs', do: [{ narr: '계단참에 작은 신발 한 켤레가 가지런히 놓여 있다. 아까까지는 없었다.' }] },
      {
        id: 't10', on: 'time', left: 600,
        do: [{ voice: '소등 10분 전입니다. 모든 환자는 병실로 돌아가십시오.', speaker: '원내 방송', to: 'all' }, { effect: 'alarm', to: 'all' }],
      },
      {
        id: 't3', on: 'time', left: 180,
        do: [{ effect: 'blackout', to: 'all' }, { narr: '병동 전체가 소등됐다. 비상구 표시등만 녹색으로 깜빡인다. 복도 어딘가에서 맨발 소리가 들린다.', to: 'all' }],
      },
      {
        id: 'idle', on: 'idle', seconds: 300, repeat: true,
        do: [{ voice: '…언니야, 막혔어? 내가 알려 줄게.', speaker: '아이 목소리', to: 'all' }, { hint: '자동 힌트' }],
      },
    ],
  },
  {
    id: 'prison',
    title: '제3화 · 청운교도소',
    summary: '누명을 쓰고 독방에 갇힌 멤버들. 간수의 순찰을 피해 동이 트기 전에 담장을 넘어라.',
    timeLimit: 30 * 60,
    failText: '사이렌이 울리고 서치라이트가 멤버들을 비췄다. 탈옥 실패…',
    epilogue: [
      '세 사람은 모두 같은 사건의 범인으로 몰려 들어왔다. 하지만 진짜 범인은 청운교도소의 소장이었다.',
      '소장은 교도소 예산을 빼돌리다 그 사실을 알게 된 직원을 해쳤다. 그리고 그날 밤 교도소 안에 있던 수감자들에게 죄를 뒤집어씌웠다. 세탁실에서 혼자 돌던 붉게 물든 옷은 그날의 증거였다.',
      '박 간수는 그 모든 걸 알고 있었다. 하지만 소장을 정면으로 고발할 수는 없었다. 그래서 근무 일지에, 편지에, 식판 뒷면에 조용히 길을 남겼다. 수감자들이 스스로 나가서 진실을 말할 수 있도록.',
      '라디오에서 끊겨 나오던 속보는 박 간수가 몰래 기자에게 넘긴 제보였다. 순찰이 일정한 시각에만 돈 것도 그가 근무표를 바꿔 둔 덕분이었다.',
      '담장 너머 새벽길에는 낡은 승합차 한 대가 시동을 켜 둔 채 기다리고 있었다. 운전석의 기자가 말했다. \"박 간수님이 보내셨습니다. 이제 증언만 하시면 됩니다.\"',
      '한 달 뒤, 청운교도소 소장이 구속되었다. 판결문에는 세 사람의 무죄와 함께, 이름 대신 \"내부 고발자 박 모 씨\"라는 한 줄이 적혀 있었다.',
    ],
    map: { w: 12, h: 9 },
    starts: ['cell1', 'cell2', 'cell3'],
    intro: [
      '철컥. 쇠문 잠기는 소리에 눈을 뜬다.',
      '회색 죄수복. 가슴팍에 낯선 수번. 기억나는 건, 하지 않은 일로 끌려왔다는 것뿐이다.',
      '벽 너머 옆 감방에서도 누군가 뒤척이는 소리가 난다.',
      '"…소등. 동트기 전까지 아무도 움직이지 마라."',
    ],
    items: {
      spoon: { name: '날카로운 숟가락', icon: 'spoon' },
      cellkey: { name: '감방 열쇠 꾸러미', icon: 'key' },
      gatecard: { name: '운동장 출입 카드', icon: 'card' },
    },
    hints: [
      { until: 'd1', text: '1번 감방 — 변기 물통 안을 살펴보자. 숟가락으로 환풍구 나사를 풀 수 있다.' },
      { until: 'd2', text: '2번 감방 — 편지대로 죄수복 수번을 거꾸로.' },
      { until: 'd3', text: '3번 감방 — 벽의 선은 다섯 개씩 여섯 묶음, 그리고 셋.' },
      { until: 'dG', text: '간수실 비밀번호는 식당 메뉴판에 있다.' },
      { until: 'keyrack', text: '간수실 열쇠 보관함에서 감방 열쇠를 챙기자. 남은 동료를 꺼낼 수 있다.' },
      { until: 'basket', text: '근무 일지에 운동장 카드 위치가 적혀 있다. 세탁실 빨래 바구니.' },
      { until: 'dY', text: '운동장 출입 카드로 복도 끝 철문을 연다.' },
      { until: 'wallgate', text: '모두 운동장에 모인 뒤 담장 쪽문으로.' },
    ],
    links: [
      { id: 'w12', a: 'cell1', b: 'cell2', kind: 'wall' },
      { id: 'w23', a: 'cell2', b: 'cell3', kind: 'wall' },
      { id: 'w3g', a: 'cell3', b: 'guard', kind: 'wall' },
      { id: 'd1', a: 'cell1', b: 'block', kind: 'door', locked: true },
      { id: 'd2', a: 'cell2', b: 'block', kind: 'door', locked: true },
      { id: 'd3', a: 'cell3', b: 'block', kind: 'door', locked: true },
      { id: 'dG', a: 'guard', b: 'block', kind: 'door', locked: true },
      { id: 'dM', a: 'block', b: 'mess', kind: 'open' },
      { id: 'dL', a: 'mess', b: 'laundry', kind: 'open' },
      { id: 'dY', a: 'block', b: 'yard', kind: 'door', locked: true },
      { id: 'wMY', a: 'mess', b: 'yard', kind: 'wall' },
    ],
    rooms: {
      cell1: {
        name: '1번 감방', rect: [0, 0, 3, 3],
        desc: '좁은 독방. 녹슨 변기와 철제 침상, 천장 가까이 환풍구가 있다.',
        objects: [
          {
            id: 'bunk1', name: '철제 침상', icon: 'bed',
            desc: '침상 다리에 누군가 새겨 놓았다: "나는 안 했어."',
            bonus: '침상 아래 벽돌 하나가 헐겁다. 뒤는 비어 있다… 누가 먼저 가져갔다.',
          },
          {
            id: 'toilet1', name: '녹슨 변기', icon: 'toilet',
            desc: '변기 물통 뚜껑이 살짝 어긋나 있다.',
            onSolve: { text: '물통 안에서 끝을 날카롭게 간 숟가락이 나왔다.', item: 'spoon' },
            solvedDesc: '물통 안은 이제 비어 있다.',
          },
          {
            id: 'vent1', name: '환풍구 덮개', icon: 'plank',
            desc: '나사 네 개로 고정된 환풍구 덮개. 복도 쪽으로 이어져 있다.',
            needItem: 'spoon', lackText: '맨손으로는 나사를 풀 수 없다.',
            onSolve: { text: '숟가락 끝으로 나사를 풀어내자 덮개가 떨어진다. 기어서 복도로 나갈 수 있다.', unlock: 'd1' },
            solvedDesc: '덮개가 떨어진 환풍구. 복도로 이어진다.',
          },
        ],
      },
      cell2: {
        name: '2번 감방', rect: [3, 0, 3, 3],
        desc: '벽 한쪽에 사진과 편지가 붙어 있는 감방.',
        objects: [
          {
            id: 'letter', name: '벽에 붙은 편지', icon: 'note',
            desc: '"형, 걱정 마. 형 방 자물쇠는 형 수번을 거꾸로 하면 열려. — 간수 조카가"',
            bonus: '편지 뒷면: "간수실 근무 일지를 꼭 봐."',
          },
          { id: 'uniform2', name: '죄수복', icon: 'clipboard', desc: '가슴팍에 수번이 박혀 있다: 4127.' },
          {
            id: 'lock2', name: '감방 자물쇠', icon: 'padlock',
            desc: '창살 사이로 손을 뻗으면 닿는 4자리 자물쇠.',
            lock: { answer: '7214', prompt: '4자리 숫자를 입력하세요.', hint: '수번을 거꾸로.', forceable: true },
            onSolve: { text: '자물쇠가 툭 풀리고 감방 문이 열린다.', unlock: 'd2' },
            solvedDesc: '풀린 자물쇠가 바닥에 떨어져 있다.',
          },
        ],
      },
      cell3: {
        name: '3번 감방', rect: [6, 0, 3, 3],
        desc: '창살 너머로 간수실 불빛이 새어 들어오는 감방. 벽에 날짜를 센 선이 가득하다.',
        objects: [
          {
            id: 'tally3', name: '날짜 센 선', icon: 'graffiti',
            desc: '다섯 개씩 묶은 선이 여섯 묶음, 그리고 세 줄 더.',
            bonus: '맨 마지막 줄 옆에 작게: "자물쇠 번호 = 내가 여기 있은 날".',
          },
          {
            id: 'peek', name: '간수실 쪽 창살', icon: 'mirror',
            desc: '창살 틈으로 간수실이 보인다. 벽에 열쇠 꾸러미가 걸려 있다.',
          },
          {
            id: 'lock3', name: '다이얼 자물쇠', icon: 'padlock',
            desc: '2자리 다이얼 자물쇠.',
            lock: { answer: '33', prompt: '2자리 숫자를 입력하세요.', hint: '벽의 선을 세어 보자.', forceable: true },
            onSolve: { text: '다이얼이 맞물리고 감방 문이 열린다.', unlock: 'd3' },
            solvedDesc: '열린 자물쇠.',
          },
        ],
      },
      guard: {
        name: '간수실', rect: [9, 0, 3, 3],
        desc: '모니터와 서류철이 놓인 간수실. 식은 커피에서 아직 김이 오른다.',
        objects: [
          {
            id: 'keyrack', name: '열쇠 보관함', icon: 'keybox',
            desc: '벽에 걸린 열쇠 보관함.',
            onSolve: { text: '"감방" 이름표가 붙은 열쇠 꾸러미를 챙겼다.', item: 'cellkey' },
            solvedDesc: '비어 있는 열쇠 고리.',
          },
          { id: 'guardcctv', name: 'CCTV 모니터', icon: 'monitor', desc: '교도소 곳곳이 흑백 화면에 비친다.', cctv: true },
          {
            id: 'logbook', name: '근무 일지', icon: 'book',
            desc: '"운동장 철문 카드는 세탁실 빨래 바구니에 숨겨 둠. 소장님께 들키지 말 것. — 박 간수"',
            bonus: '그 아래 다른 글씨: "세 사람 다 누명이다. 내가 증거를 숨겨 뒀다."',
          },
        ],
      },
      block: {
        name: '수감동 복도', rect: [0, 3, 12, 2],
        desc: '감방 문이 늘어선 어두운 복도. 문마다 굵은 자물쇠가 걸려 있다.',
        objects: [
          {
            id: 'out1', name: '1번 감방 문', icon: 'door', desc: '굵은 자물쇠가 걸린 1번 감방 문.',
            needItem: 'cellkey', keepItem: true, lackText: '감방 열쇠가 필요하다.',
            onSolve: { text: '열쇠가 맞물리고 1번 감방 문이 열린다.', unlock: 'd1' },
          },
          {
            id: 'out2', name: '2번 감방 문', icon: 'door', desc: '굵은 자물쇠가 걸린 2번 감방 문.',
            needItem: 'cellkey', keepItem: true, lackText: '감방 열쇠가 필요하다.',
            onSolve: { text: '열쇠가 맞물리고 2번 감방 문이 열린다.', unlock: 'd2' },
          },
          {
            id: 'out3', name: '3번 감방 문', icon: 'door', desc: '굵은 자물쇠가 걸린 3번 감방 문.',
            needItem: 'cellkey', keepItem: true, lackText: '감방 열쇠가 필요하다.',
            onSolve: { text: '열쇠가 맞물리고 3번 감방 문이 열린다.', unlock: 'd3' },
          },
          {
            id: 'guardLock', name: '간수실 도어락', icon: 'doorlock',
            desc: '간수실 문에 달린 4자리 도어락.',
            lock: { answer: '0912', prompt: '4자리 비밀번호를 입력하세요.', hint: '식당 메뉴판을 보자.' },
            onSolve: { text: '띠리릭— 간수실 문이 열렸다.', unlock: 'dG' },
          },
          {
            id: 'yardDoor', name: '운동장 철문', icon: 'doorlock',
            desc: '카드 리더기가 달린 운동장 철문.',
            needItem: 'gatecard', lackText: '카드 리더기가 붉게 빛난다. 운동장 출입 카드가 필요하다.',
            onSolve: { text: '삑— 운동장 철문이 열린다. 차가운 밤공기가 들이친다.', unlock: 'dY' },
          },
        ],
      },
      mess: {
        name: '식당', rect: [4, 5, 4, 4],
        desc: '긴 식탁이 늘어선 식당. 배식구 너머 주방은 어둡다.',
        objects: [
          {
            id: 'menu', name: '메뉴판', icon: 'board',
            desc: '"오늘의 식단 번호" 칸에 0, 9, 1, 2. 그 아래 누군가 볼펜으로 "간수실 비번이랑 같음 ㅋㅋ".',
          },
          { id: 'radio', name: '낡은 라디오', icon: 'speaker', desc: '주파수가 맞지 않는 라디오. 손잡이를 돌려 본다.' },
          { id: 'tray', name: '식판 더미', icon: 'note', desc: '식판 하나 뒷면에 칼자국으로: "세탁실 → 바구니".' },
        ],
      },
      laundry: {
        name: '세탁실', rect: [0, 5, 4, 4],
        desc: '거대한 세탁기들이 웅웅거리는 세탁실. 축축한 빨래 냄새가 가득하다.',
        objects: [
          {
            id: 'basket', name: '빨래 바구니', icon: 'cabinet',
            desc: '죄수복이 산더미처럼 쌓인 바구니.',
            onSolve: { text: '빨래 더미 맨 아래에서 운동장 출입 카드를 찾았다.', item: 'gatecard' },
            solvedDesc: '헤집어 놓은 빨래 더미.',
          },
          { id: 'washer', name: '세탁기', icon: 'safe', desc: '세탁기 하나가 덜컹거리며 혼자 돌아간다. 안에 붉게 물든 옷이 보인다.' },
        ],
      },
      yard: {
        name: '운동장', rect: [8, 5, 4, 4],
        desc: '서치라이트가 훑고 지나가는 운동장. 담장 한쪽에 작은 쪽문이 있다.',
        objects: [
          {
            id: 'wallgate', name: '담장 쪽문', icon: 'exit',
            desc: '녹슨 쪽문. 서치라이트가 지나간 직후에만 빠져나갈 수 있다.',
            needAll: true,
            onSolve: { text: '서치라이트가 비켜 가는 순간, 모두 함께 쪽문을 빠져나간다. 담장 너머 새벽 공기가 차갑다.', ending: 'escape' },
          },
        ],
      },
    },
    events: [
      { id: 'start-pa', on: 'start', do: [{ voice: '소등. 전원 취침. 순찰은 수시로 돈다.', speaker: '교도소 방송', to: 'all' }] },
      { id: 'radio', on: 'inspect', obj: 'radio', do: [{ voice: '…속보입니다. 청운교도소 수감자 세 명에 대한 누명 의혹이… 지지직…', speaker: '라디오' }] },
      {
        id: 'block-first', on: 'enter', room: 'block',
        do: [{ effect: 'flicker' }, { narr: '복도 끝 간수실 문틈으로 불빛이 새어 나온다. 아무도 없는 것 같다… 지금은.' }],
      },
      {
        id: 'patrol1', on: 'time', elapsed: 600,
        do: [
          { voice: '점호 준비. 순찰 돈다.', speaker: '간수', to: 'all' },
          { effect: 'flicker', to: 'all' },
          { lock: 'dG' },
          { narr: '군홧발 소리가 복도를 따라 다가온다. 간수실 문이 철컥 잠긴다.', to: 'block' },
          {
            to: 'block',
            attack: {
              id: 'hide', seconds: 25, label: '간수가 온다! 복도에서 벗어나 숨어라',
              until: { noneIn: 'block' },
              success: [{ narr: '숨죽인 채 군홧발 소리가 지나가기를 기다렸다.', to: 'all' }],
              fail: [{ narr: '간수에게 들킨 사람이 1번 감방으로 끌려갔다.', to: 'all' }, { moveTo: 'cell1' }],
            },
          },
        ],
      },
      { id: 'patrol1-end', on: 'time', elapsed: 720, do: [{ release: 'dG' }, { narr: '발소리가 멀어졌다. 간수실 문 잠금이 풀리는 소리가 난다.', to: 'block' }] },
      {
        id: 'patrol2', on: 'time', elapsed: 1260,
        do: [
          { voice: '운동장 서치라이트 점검. 출입 통제.', speaker: '간수', to: 'all' },
          { lock: 'dY' },
          { narr: '운동장 쪽 철문에 빗장 걸리는 소리가 난다.', to: 'block' },
        ],
      },
      { id: 'patrol2-end', on: 'time', elapsed: 1380, do: [{ release: 'dY' }, { narr: '운동장 철문의 빗장이 다시 풀렸다.', to: 'block' }] },
      {
        id: 'yard-first', on: 'enter', room: 'yard',
        do: [{ effect: 'flicker' }, { narr: '서치라이트가 {name}의 발끝을 스치고 지나간다. 숨을 멈췄다.' }],
      },
      { id: 'reunion', on: 'together', count: 'all', do: [{ narr: '모두 모였다. 이제 담장만 넘으면 된다.' }] },
      { id: 't3', on: 'time', left: 180, do: [{ effect: 'alarm', to: 'all' }, { voice: '탈옥수 발생! 전 구역 봉쇄 준비!', speaker: '교도소 방송', to: 'all' }] },
      {
        id: 'idle', on: 'idle', seconds: 300, repeat: true,
        do: [{ voice: '…이봐, 신입. 힌트 하나 줄까?', speaker: '옆방 죄수', to: 'all' }, { hint: '자동 힌트' }],
      },
    ],
  },
  {
    id: 'school',
    title: '제4화 · 한빛중학교 구관',
    summary: '방과 후 아무도 쓰지 않는 구관에서 눈을 뜬 멤버들. 하교 종이 울리기 전에 현관으로 나가야 한다. 20년 전, 이 학교에서 사라진 아이가 있다.',
    timeLimit: 30 * 60,
    failText: '종이 울렸다. 구관의 문이 모두 잠겼다. 아무도 하교하지 못했다…',
    epilogue: [
      '20년 전, 한빛중학교 2학년 3반 17번 윤하람은 합창대회 지휘를 맡았던 조용한 아이였다. 그해 금상을 탔지만, 사진 속 하람을 기억하는 친구는 거의 없었다.',
      '하람은 늘 혼자였다. 책상에 새긴 \"아무도 날 안 찾아\"는 투정이 아니었다. 그날 방과 후, 반 아이들이 숨바꼭질을 하자며 하람을 술래 없는 구관에 숨겨 두고 그대로 하교해 버렸다.',
      '하교 종이 울리고 구관의 문이 모두 잠겼다. 도서실에서 빌린 「집으로 가는 길」은 끝내 반납되지 않았다. 다음 날부터 구관은 \"안전 문제\"로 폐쇄되었고, 아무도 그 안을 찾아보지 않았다.',
      '그 뒤로 해마다 방과 후 구관에 남은 아이들은 이상한 일을 겪었다. 하람은 겁을 주려던 게 아니었다. 이번에는 누군가 자기를 데리고 같이 하교해 주기를 바랐을 뿐이다.',
      '방송실 마이크 앞의 \"같이 가고 싶어\"는 하람이 20년 동안 하지 못한 말이었다. 멤버들이 모두 함께 현관을 나설 때, 하람도 처음으로 그 문을 지나갔다.',
      '이튿날, 구관 철거 공사를 앞두고 교실 사물함에서 이름표가 붙은 실내화 한 짝과 대출 기록이 발견되었다. 동창회 단체 채팅방에 누군가 그 사진을 올렸다. 한참 뒤에 한 사람이 답했다. \"미안해, 하람아.\"',
    ],
    map: { w: 12, h: 9 },
    starts: ['classA', 'music', 'science'],
    intro: [
      '딩— 동— 댕— 동—',
      '낡은 스피커에서 일그러진 종소리가 울린다. 책상에 엎드려 있던 멤버들이 고개를 든다.',
      '창밖은 이미 해가 졌다. 복도 쪽에서 실내화 끄는 소리가 났다가 멈춘다.',
      '"…하교 시간입니다. 아직 남아 있는 학생은 없겠지요?"',
    ],
    items: {
      roomkey: { name: '교실 열쇠', icon: 'key' },
      battery: { name: '건전지', icon: 'fuse' },
      bkey: { name: '방송실 열쇠', icon: 'key' },
      gatekey: { name: '현관 열쇠', icon: 'key' },
    },
    hints: [
      { until: 'dA', text: '2학년 3반 — 칠판의 주번 번호로 사물함을 연다.' },
      { until: 'dM', text: '음악실 — 악보의 계이름을 계이름 표 숫자로.' },
      { until: 'dS', text: '과학실 — 산소 8, 나트륨 11.' },
      { until: 'dLib', text: '복도 진열장 사진의 연도가 도서실 비밀번호.' },
      { until: 'libdesk', text: '도서실 사서 책상 서랍을 열어 보자.' },
      { until: 'dB', text: '방송실 열쇠로 방송실 문을 연다.' },
      { until: 'console', text: '과학실 약품장의 건전지를 방송 콘솔에.' },
      { until: 'dF', text: '현관 열쇠로 중앙 현관 문을 연다.' },
      { until: 'exitdoor', text: '모두 중앙 현관에 모인 뒤 밖으로.' },
    ],
    links: [
      { id: 'wAM', a: 'classA', b: 'music', kind: 'wall' },
      { id: 'wMS', a: 'music', b: 'science', kind: 'wall' },
      { id: 'dA', a: 'classA', b: 'hall', kind: 'door', locked: true },
      { id: 'dM', a: 'music', b: 'hall', kind: 'door', locked: true },
      { id: 'dS', a: 'science', b: 'hall', kind: 'door', locked: true },
      { id: 'dLib', a: 'hall', b: 'library', kind: 'door', locked: true },
      { id: 'dB', a: 'hall', b: 'broadcast', kind: 'door', locked: true },
      { id: 'dF', a: 'hall', b: 'gate', kind: 'door', locked: true },
      { id: 'wLB', a: 'library', b: 'broadcast', kind: 'wall' },
      { id: 'wBG', a: 'broadcast', b: 'gate', kind: 'wall' },
    ],
    rooms: {
      classA: {
        name: '2학년 3반', rect: [0, 0, 4, 4],
        desc: '책걸상이 반듯하게 놓인 교실. 칠판에 분필 글씨가 남아 있다.',
        objects: [
          { id: 'boardA', name: '칠판', icon: 'board', desc: '칠판 구석: "오늘의 주번 — 17번 윤하람". 날짜는 20년 전이다.' },
          {
            id: 'deskA', name: '맨 뒷자리 책상', icon: 'note',
            desc: '책상 안쪽에 연필로: "내 번호로 사물함을 열어 줘. 거기 열쇠 있어."',
            bonus: '책상 위에 칼로 새긴 글씨: "아무도 날 안 찾아."',
          },
          {
            id: 'lockerA', name: '교실 사물함', icon: 'cabinet',
            desc: '2자리 번호 자물쇠가 달린 사물함.',
            lock: { answer: '17', prompt: '2자리 숫자를 입력하세요.', hint: '칠판의 주번 번호.', forceable: true },
            onSolve: { text: '사물함 안에 교실 열쇠와 낡은 실내화 한 짝.', item: 'roomkey' },
            solvedDesc: '실내화 한 짝만 남은 사물함.',
          },
          {
            id: 'doorA', name: '교실 앞문', icon: 'door',
            desc: '잠긴 미닫이 앞문.',
            needItem: 'roomkey', lackText: '앞문이 잠겨 있다. 교실 열쇠가 필요하다.',
            onSolve: { text: '열쇠를 돌리자 드르륵, 앞문이 열린다.', unlock: 'dA' },
            solvedDesc: '열린 앞문. 복도로 이어진다.',
          },
        ],
      },
      music: {
        name: '음악실', rect: [4, 0, 4, 4],
        desc: '먼지 쌓인 피아노가 놓인 음악실. 벽에 계이름 표가 붙어 있다.',
        objects: [
          { id: 'piano', name: '피아노', icon: 'piano', desc: '보면대에 악보 한 장: 솔 · 미 · 도 · 레.' },
          { id: 'solfege', name: '계이름 표', icon: 'note', desc: '도 1 / 레 2 / 미 3 / 파 4 / 솔 5 / 라 6 / 시 7' },
          {
            id: 'doorM', name: '음악실 번호키', icon: 'doorlock',
            desc: '4자리 번호키가 달린 문.',
            lock: { answer: '5312', prompt: '4자리 숫자를 입력하세요.', hint: '악보의 계이름을 숫자로.' },
            onSolve: { text: '삑삑삑— 음악실 문이 열렸다.', unlock: 'dM' },
            solvedDesc: '열린 문. 복도로 이어진다.',
          },
        ],
      },
      science: {
        name: '과학실', rect: [8, 0, 4, 4],
        desc: '약품 냄새가 배어 있는 과학실. 구석에 인체 모형이 서 있다.',
        objects: [
          { id: 'skeleton', name: '인체 모형', icon: 'skull', desc: '반쪽은 뼈, 반쪽은 근육이 드러난 모형.' },
          {
            id: 'periodic', name: '주기율표', icon: 'board',
            desc: '주기율표. 산소(O)와 나트륨(Na)에만 빨간 동그라미.',
            bonus: '동그라미 옆에 작게: "원자번호를 두 자리씩".',
          },
          {
            id: 'chemcab', name: '약품장', icon: 'cabinet',
            desc: '유리문 약품장. 맨 아래 칸에 건전지 한 묶음이 보인다.',
            onSolve: { text: '약품장에서 새 건전지를 챙겼다.', item: 'battery' },
            solvedDesc: '건전지가 빠진 약품장.',
          },
          {
            id: 'doorS', name: '과학실 문', icon: 'doorlock',
            desc: '4자리 도어락이 달린 문.',
            lock: { answer: '0811', prompt: '4자리 숫자를 입력하세요.', hint: '산소와 나트륨의 원자번호.', forceable: true },
            onSolve: { text: '철컥— 과학실 문이 열렸다.', unlock: 'dS' },
            solvedDesc: '열린 문. 복도로 이어진다.',
          },
        ],
      },
      hall: {
        name: '구관 복도', rect: [0, 4, 12, 2],
        desc: '삐걱거리는 나무 복도. 창밖은 이미 어둑하다. 교실 문마다 바깥 걸쇠가 걸려 있다.',
        objects: [
          {
            id: 'latchA', name: '2학년 3반 걸쇠', icon: 'plank', desc: '2학년 3반 앞문 바깥 걸쇠.',
            onSolve: { text: '걸쇠를 젖히자 2학년 3반 앞문이 열린다.', unlock: 'dA' },
          },
          {
            id: 'latchM', name: '음악실 걸쇠', icon: 'plank', desc: '음악실 문 바깥 걸쇠.',
            onSolve: { text: '걸쇠를 젖히자 음악실 문이 열린다.', unlock: 'dM' },
          },
          {
            id: 'latchS', name: '과학실 걸쇠', icon: 'plank', desc: '과학실 문 바깥 걸쇠.',
            onSolve: { text: '걸쇠를 젖히자 과학실 문이 열린다.', unlock: 'dS' },
          },
          {
            id: 'trophy', name: '트로피 진열장', icon: 'frame',
            desc: '합창대회 사진들. "2006년 금상 — 지휘 윤하람". 사진 속 그 아이만 얼굴이 흐릿하다.',
          },
          {
            id: 'libDoor', name: '도서실 문', icon: 'doorlock',
            desc: '4자리 번호키가 달린 도서실 문.',
            lock: { answer: '2006', prompt: '4자리 숫자를 입력하세요.', hint: '진열장 사진의 연도.' },
            onSolve: { text: '도서실 문이 끼익 열린다.', unlock: 'dLib' },
          },
          {
            id: 'bcDoor', name: '방송실 문', icon: 'door',
            desc: '"방송실 — 관계자 외 출입 금지".',
            needItem: 'bkey', lackText: '방송실 열쇠가 필요하다.',
            onSolve: { text: '열쇠가 돌아가고 방송실 문이 열린다.', unlock: 'dB' },
          },
          {
            id: 'frontDoor', name: '중앙 현관 문', icon: 'exit',
            desc: '쇠사슬이 감긴 중앙 현관 쪽 문.',
            needItem: 'gatekey', lackText: '쇠사슬에 자물쇠가 채워져 있다. 현관 열쇠가 필요하다.',
            onSolve: { text: '자물쇠가 풀리고 쇠사슬이 바닥으로 흘러내린다.', unlock: 'dF' },
          },
        ],
      },
      library: {
        name: '도서실', rect: [0, 6, 4, 3],
        desc: '책장 사이로 먼지가 내려앉은 도서실.',
        objects: [
          { id: 'loancard', name: '대출 카드', icon: 'clipboard', desc: '"마지막 대출자: 2학년 3반 윤하람 — 「집으로 가는 길」 — 미반납".' },
          {
            id: 'libdesk', name: '사서 책상', icon: 'cabinet',
            desc: '서랍이 여러 칸 달린 사서 책상.',
            onSolve: { text: '서랍 안에 "방송실" 이름표가 달린 열쇠가 있다.', item: 'bkey' },
            solvedDesc: '열어 둔 서랍.',
          },
          { id: 'shelf', name: '책장', icon: 'book', desc: '「집으로 가는 길」 자리만 비어 있다.' },
        ],
      },
      broadcast: {
        name: '방송실', rect: [4, 6, 4, 3],
        desc: '낡은 방송 장비가 가득한 방송실. 마이크의 빨간 불은 꺼져 있다.',
        objects: [
          {
            id: 'console', name: '방송 콘솔', icon: 'keypad',
            desc: '버튼이 잔뜩 달린 방송 콘솔. 전원이 꺼져 있다.',
            needItem: 'battery', lackText: '전원이 들어오지 않는다. 건전지가 필요하다.',
            onSolve: { text: '건전지를 끼우자 콘솔에 불이 들어온다. 서랍이 툭 열리며 현관 열쇠가 보인다.', item: 'gatekey' },
            solvedDesc: '불이 들어온 콘솔. 마이크가 켜져 있다.',
          },
          { id: 'mic', name: '마이크', icon: 'speaker', desc: '마이크 앞에 「집으로 가는 길」이 펼쳐져 있다. 마지막 장에 "같이 가고 싶어".' },
        ],
      },
      gate: {
        name: '중앙 현관', rect: [8, 6, 4, 3],
        desc: '유리문 너머로 어두운 운동장이 보이는 중앙 현관.',
        objects: [
          {
            id: 'exitdoor', name: '현관 밖으로', icon: 'exit',
            desc: '유리문을 밀면 운동장이다.',
            needAll: true,
            onSolve: { text: '현관문을 밀고 다 같이 밖으로 나선다. 뒤를 돌아보니 2층 창가에서 작은 그림자가 손을 흔들고 있다.', ending: 'escape' },
          },
        ],
      },
    },
    events: [
      { id: 'start-pa', on: 'start', do: [{ voice: '딩동댕동— 하교 시간입니다. 아직 학교에 남아 있는 학생은… 없겠지요?', speaker: '교내 방송', to: 'all' }] },
      { id: 'piano', on: 'inspect', obj: 'piano', do: [{ effect: 'flicker' }, { narr: '손대지도 않았는데 건반 하나가 저절로 눌린다. 솔—.' }] },
      { id: 'skeleton', on: 'inspect', obj: 'skeleton', do: [{ narr: '모형의 고개가 {name} 쪽으로 돌아가 있다. 방금 전까지는 정면을 보고 있었다.' }] },
      {
        id: 'hall-first', on: 'enter', room: 'hall',
        do: [{ effect: 'flicker' }, { narr: '복도 끝에서 실내화 끄는 소리가 들린다. 탁, 탁, 탁. 그리고 멈춘다.' }],
      },
      { id: 'library-first', on: 'enter', room: 'library', do: [{ narr: '책장 꼭대기에서 책 한 권이 떨어진다. 펼쳐진 페이지에 연필 글씨: "같이 가자."' }] },
      {
        id: 'console-on', on: 'solve', obj: 'console',
        do: [
          { effect: 'flicker', to: 'all' },
          { voice: '…다들 집에 가는구나. 나도… 데려가 줘. 종이 울리기 전에.', speaker: '교내 방송', to: 'all' },
          {
            to: 'all',
            attack: {
              id: 'bell', seconds: 180, label: '하교 종이 울리기 전에 모두 중앙 현관으로',
              until: { allIn: 'gate' },
              success: [{ narr: '모두 현관에 모였다. 머리 위 스피커가 숨을 들이쉬는 소리가 난다.', to: 'all' }],
              fail: [{ gameover: '종이 울렸다. 구관의 문이 모두 잠겼다. 아무도 하교하지 못했다…' }],
            },
          },
        ],
      },
      { id: 'reunion', on: 'together', count: 'all', do: [{ narr: '모두 모였다. 누군가 한 명 더 있는 것 같은 기분이 든다. 세어 보면 맞는데.' }] },
      {
        id: 't10', on: 'time', left: 600,
        do: [{ voice: '하교 10분 전입니다. 곧 교실 문을 잠급니다.', speaker: '교내 방송', to: 'all' }, { effect: 'alarm', to: 'all' }],
      },
      {
        id: 't3', on: 'time', left: 180,
        do: [{ effect: 'blackout', to: 'all' }, { narr: '구관 전체의 불이 꺼졌다. 어둠 속에서 누군가 출석을 부르기 시작한다. "…17번, 윤하람."', to: 'all' }],
      },
      {
        id: 'idle', on: 'idle', seconds: 300, repeat: true,
        do: [{ voice: '…언니, 오빠. 여기 봐. 내가 알려 줄게.', speaker: '아이 목소리', to: 'all' }, { hint: '자동 힌트' }],
      },
    ],
  },
  {
    id: 'mansion',
    title: '제5화 · 백목련 저택의 마지막 만찬',
    summary: '자정의 만찬에 초대받은 멤버들은 각자 잠긴 객실에서 눈을 뜬다. 20년 전 크리스마스 이브, 이 저택에서 한 아이가 사라졌다. 2층부터 지하까지, 저택 전체를 뒤져야 하는 긴 에피소드.',
    timeLimit: 90 * 60,
    failText: '자정의 종이 열두 번 울렸다. 만찬은 끝나지 않는다. 손님들은 영원히 이 저택의 식탁에 앉아 있게 되었다…',
    epilogue: [
      '2004년 12월 24일, 백목련 저택에서는 외동딸 서하윤의 열 번째 생일 만찬이 열리고 있었다. 장미, 백합, 동백, 목련의 손님 네 명이 초대되었다.',
      '만찬이 시작되기 전, 하윤은 집사 문 씨에게 숨바꼭질을 하자고 졸랐다. 아무도 못 찾는 곳에 숨겠다며 온실 바닥의 비밀 계단으로 내려갔다. 지하 예배당은 저택 사람들도 거의 모르는 곳이었다.',
      '하윤을 따라 내려간 집사는 어두운 계단에서 아이의 손을 놓쳤다. 아이는 일어나지 못했다. 겁에 질린 집사는 철판을 닫고 아무에게도 말하지 않았다. 경찰은 저택을 뒤졌지만 지하는 찾지 않았다. 몇 해 뒤, 집사는 아무도 모르게 아이를 정원의 목련 나무 아래에 묻어 주었다.',
      '부모는 20년 동안 딸을 찾았다. 부인은 아이 방에 들어가지 못한 채 부치지 못한 편지만 썼고, 회장은 금고 번호를 딸의 생일로 바꾼 뒤 그 날짜를 매일 손으로 돌렸다. 집사는 매일 밤 예배당에 촛불을 켰다.',
      '회장은 죽기 전, 그날 밤의 손님 자리를 그대로 다시 차려 \"마지막 만찬\"의 초대장을 보냈다. 유언장의 부탁은 하나였다. 딸을 집 밖으로 데려가 달라는 것.',
      '자장가가 예배당을 채우던 순간, 하윤은 20년 만에 술래를 만났다. 이듬해 봄, 집사의 자백으로 목련 나무 아래에서 하윤이 발견되었다. 하윤은 처음으로 부모 곁에 묻혔다. 그해 목련은 유난히 하얗게 피었다.',
    ],
    map: { w: 20, h: 13 },
    starts: ['guestA', 'guestB', 'guestC', 'guestD'],
    intro: [
      '똑, 똑, 똑.',
      '정중한 노크 소리에 멤버들이 눈을 뜬다. 낯선 객실, 낯선 침대. 창밖에는 눈이 내리고 있다.',
      '머리맡에 봉투가 하나 놓여 있다. 금박으로 찍힌 하얀 목련 한 송이.',
      '문 너머에서 늙은 목소리가 말한다. "손님 여러분, 백목련 저택에 오신 것을 환영합니다. 만찬은 자정에 시작됩니다."',
      '발소리가 멀어진다. 객실 문은 밖에서 잠겨 있다.',
    ],
    items: {
      keyA: { name: '장미 객실 열쇠', icon: 'key' },
      keyB: { name: '백합 객실 열쇠', icon: 'key' },
      keyC: { name: '동백 객실 열쇠', icon: 'key' },
      keyD: { name: '목련 객실 열쇠', icon: 'key' },
      studykey: { name: '서재 열쇠', icon: 'key' },
      tinykey: { name: '아주 작은 열쇠', icon: 'key' },
      nurserykey: { name: '아이 방 열쇠', icon: 'key' },
      matches: { name: '성냥갑', icon: 'candle' },
      paperknife: { name: '은제 편지칼', icon: 'hairpin' },
      stairkey: { name: '계단 철문 열쇠', icon: 'key' },
      greenkey: { name: '온실 열쇠', icon: 'key' },
      gatekey: { name: '녹슨 정원 열쇠', icon: 'key' },
    },
    hints: [
      { until: 'dGA', text: '장미 객실 — 거울 글씨를 거꾸로 읽어 트렁크에.' },
      { until: 'dGB', text: '백합 객실 — 베개 쪽지의 순서대로 초의 개수를 이어 붙인다.' },
      { until: 'dGC', text: '동백 객실 — 달력에 동그라미 친 날짜를 월일 4자리로.' },
      { until: 'dGD', text: '목련 객실 — 체스판에 남은 말이 서 있는 칸 이름.' },
      { until: 'dMa', text: '2층 복도 초상화의 결혼 날짜를 안방 번호키에.' },
      { until: 'vitrine', text: '네 객실 초대장의 자리 번호 순서대로, 화랑 그림의 숫자를 늘어놓는다.' },
      { until: 'dSt', text: '화랑 진열장에서 나온 열쇠로 서재 문을 연다.' },
      { until: 'jewelry', text: '서재 책상 서랍의 작은 열쇠는 안방 보석함에 맞는다.' },
      { until: 'dNu', text: '보석함의 열쇠로 아이 방 문을 연다.' },
      { until: 'studysafe', text: '안방 일기장 — 서재 금고 번호는 아이 방 문패의 생일 6자리.' },
      { until: 'dStairs', text: '서재 금고의 열쇠로 2층 복도의 계단 철문을 연다.' },
      { until: 'dDin', text: '1층 중앙홀에서 모두 모인 뒤 만찬장 문을 연다.' },
      { until: 'candles', text: '안방 옷장의 성냥으로 만찬장 촛대에 불을 붙인다.' },
      { until: 'dLib', text: '촛불 그림자의 숫자가 도서실 비밀번호.' },
      { until: 'ladderbox', text: '주방 요리사 메모 — 케이크 초의 개수 뒤에 코스 수를 붙인다.' },
      { until: 'dGr', text: '도서실 상자에서 나온 열쇠로 온실 문을 연다.' },
      { until: 'hatch', text: '서재 꽃말 사전 — "이루지 못한 사랑"의 꽃.' },
      { until: 'valve', text: '저장고 벽 분필 순서대로 손잡이 번호를 돌린다.' },
      { until: 'will', text: '안방 화장대의 편지칼로 서재 유언장을 뜯어 본다.' },
      { until: 'organ', text: '아이 방 오르골의 자장가를 오르간 명판대로 영문 음이름으로.' },
      { until: 'dGarden', text: '오르간에서 나온 열쇠로 예배당의 정원 쪽 철문을 연다.' },
      { until: 'exitgate', text: '모두 정원에 모인 뒤 대문 밖으로.' },
    ],
    links: [
      { id: 'wAB', a: 'guestA', b: 'guestB', kind: 'wall' },
      { id: 'wBC', a: 'guestB', b: 'guestC', kind: 'wall' },
      { id: 'wCD', a: 'guestC', b: 'guestD', kind: 'wall' },
      { id: 'wDS', a: 'guestD', b: 'study', kind: 'wall' },
      { id: 'dGA', a: 'guestA', b: 'corridor', kind: 'door', locked: true },
      { id: 'dGB', a: 'guestB', b: 'corridor', kind: 'door', locked: true },
      { id: 'dGC', a: 'guestC', b: 'corridor', kind: 'door', locked: true },
      { id: 'dGD', a: 'guestD', b: 'corridor', kind: 'door', locked: true },
      { id: 'dSt', a: 'study', b: 'corridor', kind: 'door', locked: true },
      { id: 'dMa', a: 'corridor', b: 'master', kind: 'door', locked: true },
      { id: 'dNu', a: 'corridor', b: 'nursery', kind: 'door', locked: true },
      { id: 'dGal', a: 'corridor', b: 'gallery', kind: 'door' },
      { id: 'dStairs', a: 'corridor', b: 'stairs', kind: 'door', locked: true },
      { id: 'wMN', a: 'master', b: 'nursery', kind: 'wall' },
      { id: 'sH', a: 'stairs', b: 'hall', kind: 'open' },
      { id: 'dDin', a: 'hall', b: 'dining', kind: 'door', locked: true },
      { id: 'dKit', a: 'dining', b: 'kitchen', kind: 'door' },
      { id: 'dLib', a: 'hall', b: 'library', kind: 'door', locked: true },
      { id: 'dGr', a: 'hall', b: 'greenhouse', kind: 'door', locked: true },
      { id: 'dCel', a: 'greenhouse', b: 'cellar', kind: 'door', locked: true },
      { id: 'dCh', a: 'cellar', b: 'chapel', kind: 'door', locked: true },
      { id: 'dGarden', a: 'chapel', b: 'garden', kind: 'door', locked: true },
    ],
    rooms: {
      guestA: {
        name: '장미 객실', rect: [0, 0, 3, 3],
        desc: '붉은 벽지에 장미 무늬가 번진 객실. 화장대 거울이 유난히 크다.',
        objects: [
          { id: 'invA', name: '초대장', icon: 'letter', desc: '"백목련 저택 마지막 만찬에 초대합니다. 귀하의 자리는 3번, 장미의 자리입니다."' },
          {
            id: 'mirrorA', name: '화장대 거울', icon: 'mirror',
            desc: '거울에 립스틱으로 휘갈긴 글씨: "ƎƧOЯ". 이상하게 뒤집힌 글자다.',
            bonus: '거울 아래 작은 글씨: "거울 속 세상에서 읽어."',
          },
          { id: 'vaseA', name: '꽃병', icon: 'flower', desc: '장미 다섯 송이 중 세 송이가 검게 시들어 있다. 물은 오래전에 말랐다.' },
          {
            id: 'trunkA', name: '여행 트렁크', icon: 'cabinet',
            desc: '영문 다이얼 자물쇠가 달린 낡은 트렁크.',
            lock: { answer: 'ROSE', prompt: '영문 4글자를 입력하세요.', hint: '거울 글씨를 거울에 비춰 읽는다.', forceable: true },
            onSolve: { text: '트렁크 안에 장미 모양 머리가 달린 열쇠가 있다.', item: 'keyA' },
            solvedDesc: '빈 트렁크. 안쪽에 오래된 향수 냄새가 남아 있다.',
          },
          {
            id: 'doorA', name: '객실 문', icon: 'door', desc: '밖에서 잠긴 문.',
            needItem: 'keyA', lackText: '문이 잠겨 있다. 이 객실의 열쇠가 필요하다.',
            onSolve: { text: '열쇠가 돌아간다. 문 너머로 긴 복도가 보인다.', unlock: 'dGA' },
            solvedDesc: '열린 객실 문.',
          },
        ],
      },
      guestB: {
        name: '백합 객실', rect: [3, 0, 3, 3],
        desc: '하얀 커튼이 드리운 조용한 객실. 협탁 위에 색색의 초가 늘어서 있다.',
        objects: [
          { id: 'invB', name: '초대장', icon: 'letter', desc: '"백목련 저택 마지막 만찬에 초대합니다. 귀하의 자리는 1번, 백합의 자리입니다."' },
          { id: 'candlesB', name: '색색의 초', icon: 'candle', desc: '빨간 초 2개, 파란 초 7개, 초록 초 4개. 하나도 켜지 않은 새 초다.' },
          { id: 'pillowB', name: '베개 위 쪽지', icon: 'note', desc: '단정한 글씨: "빨강, 초록, 파랑. 이 순서로 불을 밝히세요."' },
          {
            id: 'boxB', name: '촛대 상자', icon: 'safe',
            desc: '3자리 숫자 자물쇠가 달린 은색 상자.',
            lock: { answer: '247', prompt: '3자리 숫자를 입력하세요.', hint: '쪽지 순서대로 각 색 초의 개수.', forceable: true },
            onSolve: { text: '상자 안 벨벳 위에 백합이 새겨진 열쇠가 놓여 있다.', item: 'keyB' },
            solvedDesc: '빈 상자.',
          },
          {
            id: 'doorB', name: '객실 문', icon: 'door', desc: '밖에서 잠긴 문.',
            needItem: 'keyB', lackText: '문이 잠겨 있다. 이 객실의 열쇠가 필요하다.',
            onSolve: { text: '철컥. 문이 열린다.', unlock: 'dGB' },
            solvedDesc: '열린 객실 문.',
          },
        ],
      },
      guestC: {
        name: '동백 객실', rect: [6, 0, 3, 3],
        desc: '짙은 녹색 벽지의 객실. 벽에 찢어진 달력이 걸려 있다.',
        objects: [
          { id: 'invC', name: '초대장', icon: 'letter', desc: '"백목련 저택 마지막 만찬에 초대합니다. 귀하의 자리는 4번, 동백의 자리입니다."' },
          {
            id: 'calendarC', name: '찢어진 달력', icon: 'board',
            desc: '20년 전 12월 달력. 24일에만 빨간 동그라미. 옆에 "그날 밤, 그 아이가 사라졌다."',
          },
          { id: 'bedC', name: '침대', icon: 'bed', desc: '누군가 방금 일어난 것처럼 이불이 흐트러져 있다. 하지만 시트는 차갑다.', bonus: '베개 밑에 아이 글씨: "숨바꼭질 하자. 아무도 못 찾을걸."' },
          {
            id: 'deskC', name: '책상 서랍', icon: 'cabinet',
            desc: '4자리 숫자 자물쇠가 달린 서랍. "월일"이라고 새겨져 있다.',
            lock: { answer: '1224', prompt: '4자리 숫자(월일)를 입력하세요.', hint: '달력에 동그라미 친 날.', forceable: true },
            onSolve: { text: '서랍 안에 동백꽃이 새겨진 열쇠.', item: 'keyC' },
            solvedDesc: '빈 서랍.',
          },
          {
            id: 'doorC', name: '객실 문', icon: 'door', desc: '밖에서 잠긴 문.',
            needItem: 'keyC', lackText: '문이 잠겨 있다. 이 객실의 열쇠가 필요하다.',
            onSolve: { text: '문이 끼익 열린다.', unlock: 'dGC' },
            solvedDesc: '열린 객실 문.',
          },
        ],
      },
      guestD: {
        name: '목련 객실', rect: [9, 0, 3, 3],
        desc: '창가에 체스 탁자가 놓인 객실. 창밖으로 눈 덮인 정원과 앙상한 목련 나무가 보인다.',
        objects: [
          { id: 'invD', name: '초대장', icon: 'letter', desc: '"백목련 저택 마지막 만찬에 초대합니다. 귀하의 자리는 2번, 목련의 자리입니다."' },
          {
            id: 'chessD', name: '체스판', icon: 'chess',
            desc: '말이 딱 하나 남아 있다. 하얀 퀸. 세로 E줄, 가로 3번째 칸.',
            bonus: '판 가장자리에 연필로: "칸 이름 = 영문 + 숫자".',
          },
          { id: 'windowD', name: '창문', icon: 'frame', desc: '정원 한가운데 목련 나무 아래만 눈이 쌓이지 않았다.' },
          {
            id: 'chestD', name: '체스 상자', icon: 'safe',
            desc: '두 칸짜리 글자 다이얼이 달린 상자. 영문 하나, 숫자 하나.',
            lock: { answer: 'E3', prompt: '칸 이름을 입력하세요. (예: A1)', hint: '남은 말이 서 있는 칸.', forceable: true },
            onSolve: { text: '상자 안에 목련 무늬 열쇠가 들어 있다.', item: 'keyD' },
            solvedDesc: '빈 체스 상자.',
          },
          {
            id: 'doorD', name: '객실 문', icon: 'door', desc: '밖에서 잠긴 문.',
            needItem: 'keyD', lackText: '문이 잠겨 있다. 이 객실의 열쇠가 필요하다.',
            onSolve: { text: '문이 열린다. 복도의 찬 공기가 밀려든다.', unlock: 'dGD' },
            solvedDesc: '열린 객실 문.',
          },
        ],
      },
      corridor: {
        name: '2층 복도', rect: [0, 3, 16, 2],
        desc: '붉은 카펫이 깔린 긴 복도. 객실 문마다 바깥 빗장이 걸려 있다. 복도 끝에 철문이 보인다.',
        objects: [
          { id: 'boltA', name: '장미 객실 빗장', icon: 'plank', desc: '장미 객실 문의 바깥 빗장.', onSolve: { text: '빗장을 밀자 장미 객실 문이 열린다.', unlock: 'dGA' } },
          { id: 'boltB', name: '백합 객실 빗장', icon: 'plank', desc: '백합 객실 문의 바깥 빗장.', onSolve: { text: '빗장을 밀자 백합 객실 문이 열린다.', unlock: 'dGB' } },
          { id: 'boltC', name: '동백 객실 빗장', icon: 'plank', desc: '동백 객실 문의 바깥 빗장.', onSolve: { text: '빗장을 밀자 동백 객실 문이 열린다.', unlock: 'dGC' } },
          { id: 'boltD', name: '목련 객실 빗장', icon: 'plank', desc: '목련 객실 문의 바깥 빗장.', onSolve: { text: '빗장을 밀자 목련 객실 문이 열린다.', unlock: 'dGD' } },
          {
            id: 'portrait', name: '부부 초상화', icon: 'frame',
            desc: '정장 차림의 부부. 금색 명판: "서진혁 · 한유정 — 1987년 5월 16일, 이 저택에서 백년가약을 맺다."',
            bonus: '부인의 품에 안긴 아기 부분만 덧칠한 흔적이 있다.',
          },
          { id: 'grandclock', name: '괘종시계', icon: 'clock', desc: '11시 40분에서 멈춰 있다. 추가 흔들리지 않는데 째깍 소리가 들린다.' },
          { id: 'intercom2', name: '인터폰', icon: 'phone', desc: '집사실로 연결되는 인터폰. 버튼을 누르자 저택 곳곳의 화면이 지직거리며 켜진다.', cctv: true, shared: true },
          {
            id: 'masterDoor', name: '안방 번호키', icon: 'doorlock',
            desc: '"주인 침실". 4자리 번호키가 달려 있다. "우리가 하나가 된 날"이라고 새겨져 있다.',
            lock: { answer: '0516', prompt: '4자리 숫자를 입력하세요.', hint: '초상화 명판의 날짜를 월일로.' },
            onSolve: { text: '삑— 안방 문이 열렸다.', unlock: 'dMa' },
          },
          {
            id: 'studyDoor', name: '서재 문', icon: 'door', desc: '묵직한 참나무 문. "서재 — 주인 외 출입 금지".',
            needItem: 'studykey', lackText: '서재 문이 잠겨 있다. 열쇠가 필요하다.',
            onSolve: { text: '육중한 서재 문이 열린다.', unlock: 'dSt' },
          },
          {
            id: 'nurseryDoor', name: '아이 방 문', icon: 'door', desc: '분홍 페인트가 벗겨진 작은 문. 문고리에 리본이 묶여 있다.',
            needItem: 'nurserykey', lackText: '아이 방 문이 잠겨 있다. 작은 열쇠 구멍이 있다.',
            onSolve: { text: '딸깍. 아이 방 문이 스르르 열린다. 아무도 밀지 않았는데.', unlock: 'dNu' },
          },
          {
            id: 'stairGate', name: '계단 철문', icon: 'padlock', desc: '1층으로 내려가는 계단을 막은 철문. 커다란 자물쇠가 채워져 있다.',
            needItem: 'stairkey', lackText: '철문이 꿈쩍도 않는다. 맞는 열쇠가 필요하다.',
            onSolve: { text: '자물쇠가 풀리고 철문이 끼이익 열린다. 아래층에서 찬 바람이 올라온다.', unlock: 'dStairs' },
          },
        ],
      },
      study: {
        name: '서재', rect: [12, 0, 4, 3],
        desc: '천장까지 닿는 책장과 커다란 책상. 시가 냄새가 아직 남아 있다.',
        objects: [
          {
            id: 'studydesk', name: '책상 서랍', icon: 'cabinet', desc: '서랍 맨 안쪽에서 무언가 반짝인다.',
            onSolve: { text: '손톱만 한 금빛 열쇠를 찾았다. 장신구 상자에나 맞을 크기다.', item: 'tinykey' },
            solvedDesc: '빈 서랍. 영수증 몇 장뿐이다.',
          },
          {
            id: 'flowerbook', name: '꽃말 사전', icon: 'book',
            desc: '책갈피가 꽂힌 페이지: 장미 — 사랑 / 백합 — 순결 / 동백 — 그대만을 사랑해 / 목련 — 이루지 못한 사랑.',
            bonus: '"목련" 옆에 만년필로 밑줄이 그어져 있다. 잉크가 번져 있다.',
          },
          { id: 'globe', name: '지구본', icon: 'pin', desc: '지구본을 돌리자 안이 빈 소리가 난다. 바닥에 "하윤이 열 살 생일 선물"이라는 쪽지가 붙어 있다.' },
          {
            id: 'will', name: '봉인된 유언장', icon: 'letter', desc: '붉은 밀랍으로 봉한 봉투. "만찬 손님에게만 공개함".',
            needItem: 'paperknife', keepItem: true, lackText: '밀랍이 단단하다. 손으로 뜯으면 찢어질 것 같다. 날붙이가 필요하다.',
            onSolve: { text: '유언장: "나는 20년 동안 딸을 찾지 못했다. 내 딸에게 가는 길은 그 아이가 잠들 때 듣던 노래 끝에 있다. 손님들이여, 부디 그 아이를 집 밖으로 데려가 주시오."' },
            solvedDesc: '"내 딸에게 가는 길은 그 아이가 잠들 때 듣던 노래 끝에 있다."',
          },
          {
            id: 'studysafe', name: '벽 금고', icon: 'safe', desc: '그림 뒤에 숨겨진 금고. 6자리 숫자 다이얼.',
            lock: { answer: '940309', prompt: '6자리 숫자를 입력하세요.', hint: '아이 방 문패에 새겨진 생년월일.' },
            onSolve: { text: '금고 안에 무거운 쇠 열쇠가 있다. 손잡이에 "계단"이라고 새겨져 있다.', item: 'stairkey' },
            solvedDesc: '빈 금고. 아이 사진 한 장이 붙어 있다.',
          },
        ],
      },
      master: {
        name: '안방', rect: [0, 5, 4, 3],
        desc: '커다란 캐노피 침대가 놓인 주인 침실. 화장대 위의 물건들이 그대로 놓여 있다.',
        objects: [
          {
            id: 'diary', name: '부인의 일기장', icon: 'book',
            desc: '"그이는 서재 금고 번호를 하윤이 생일로 해 두었다. 아이 방 문패에 새겨 둔 그 날짜. 그 방에 들어갈 엄두가 나지 않는다. 열쇠는 보석함에 넣어 두었다."',
            bonus: '마지막 장: "문 집사는 그날 밤 예배당에 있었다고 했다. 왜 지하에?"',
          },
          {
            id: 'jewelry', name: '보석함', icon: 'musicbox', desc: '아주 작은 열쇠 구멍이 있는 자개 보석함.',
            needItem: 'tinykey', lackText: '잠겨 있다. 열쇠 구멍이 손톱만 하다.',
            onSolve: { text: '보석함 안에 진주 목걸이와 분홍 리본이 달린 열쇠가 있다.', item: 'nurserykey' },
            solvedDesc: '진주 목걸이만 남은 보석함.',
          },
          {
            id: 'wardrobe', name: '옷장', icon: 'cabinet', desc: '남자 코트가 걸려 있다. 주머니가 불룩하다.',
            onSolve: { text: '코트 주머니에서 성냥갑을 찾았다. "백목련 저택 만찬 기념".', item: 'matches' },
            solvedDesc: '코트만 걸린 옷장.',
          },
          {
            id: 'vanity', name: '화장대 서랍', icon: 'cabinet', desc: '빗, 거울, 그리고 편지 뭉치.',
            onSolve: { text: '편지 뭉치 사이에서 은제 편지칼을 챙겼다.', item: 'paperknife' },
            solvedDesc: '부치지 못한 편지 뭉치. 모두 "하윤에게"로 시작한다.',
          },
        ],
      },
      nursery: {
        name: '아이 방', rect: [4, 5, 4, 3],
        desc: '20년 동안 아무도 들어오지 않은 아이 방. 먼지 위에 작은 발자국이 찍혀 있다. 방금 생긴 것처럼 선명하다.',
        objects: [
          { id: 'nameplate', name: '문패', icon: 'frame', desc: '문 안쪽의 나무 문패: "서하윤 · 1994년 3월 9일생 · 우리 집 공주님".' },
          {
            id: 'musicbox', name: '오르골', icon: 'musicbox',
            desc: '태엽을 감자 자장가가 흐른다. 뚜껑 안쪽에 악보가 새겨져 있다: 미 · 솔 · 라 · 솔 · 미.',
            bonus: '노래가 끝나는 순간, 바닥 어딘가에서 같은 음이 낮게 울린다. 아주 아래쪽에서.',
          },
          { id: 'dollhouse', name: '인형의 집', icon: 'cabinet', desc: '이 저택을 그대로 줄인 인형의 집. 인형 하나가 온실 바닥에 엎드려 있다. 바닥에 작은 뚜껑이 그려져 있다.' },
          { id: 'drawing', name: '크레파스 그림', icon: 'note', desc: '긴 식탁에 사람들이 앉아 있다. 검은 옷을 입은 키 큰 사람이 여자아이 손을 잡고 아래로 내려가는 계단을 걷고 있다.' },
        ],
      },
      gallery: {
        name: '화랑', rect: [8, 5, 4, 3],
        desc: '가족이 모은 그림들이 걸린 좁은 화랑. 그림마다 로마 숫자가 적힌 명판이 붙어 있다.',
        objects: [
          { id: 'paintRose', name: '장미 그림', icon: 'frame', desc: '붉은 장미 정물화. 명판: VII.' },
          { id: 'paintLily', name: '백합 그림', icon: 'frame', desc: '하얀 백합 정물화. 명판: II.' },
          { id: 'paintMag', name: '목련 그림', icon: 'frame', desc: '흰 목련 나무 풍경화. 명판: V.' },
          { id: 'paintCam', name: '동백 그림', icon: 'frame', desc: '눈 속의 동백꽃. 명판: IX.' },
          { id: 'emptyframe', name: '빈 액자', icon: 'frame', desc: '그림이 뜯겨 나간 액자. 명판만 남아 있다: "하윤, 열 살 생일 — 미완성".' },
          {
            id: 'vitrine', name: '유리 진열장', icon: 'keybox',
            desc: '4자리 번호 자물쇠가 달린 진열장. 안에 열쇠가 보인다. 유리에 금박 글씨: "손님이 앉는 자리 순서대로, 그 꽃의 숫자를."',
            lock: { answer: '2579', prompt: '4자리 숫자를 입력하세요.', hint: '1번 자리 꽃부터 4번 자리 꽃까지, 그림의 로마 숫자.' },
            onSolve: { text: '진열장이 열린다. "서재"라고 적힌 꼬리표가 달린 열쇠.', item: 'studykey' },
            solvedDesc: '빈 진열장.',
          },
        ],
      },
      stairs: {
        name: '중앙 계단', rect: [12, 5, 4, 3],
        desc: '1층 중앙홀로 이어지는 넓은 나선 계단. 난간이 차갑다.',
        objects: [
          { id: 'stairwindow', name: '스테인드글라스', icon: 'frame', desc: '목련 나무 아래에서 기도하는 소녀가 그려진 유리창. 달빛이 비친다.' },
          { id: 'railing', name: '난간', icon: 'plank', desc: '난간 아래쪽에 손톱으로 긁은 자국. "아저씨 어디 가?"', bonus: '자국은 아이 키 높이에 있다.' },
        ],
      },
      hall: {
        name: '1층 중앙홀', rect: [0, 8, 16, 2],
        desc: '샹들리에가 매달린 넓은 홀. 대리석 바닥이 발소리를 크게 울린다. 문이 여러 개 있다.',
        objects: [
          { id: 'frontdoor', name: '정문', icon: 'exit', desc: '밖에서 쇠사슬로 감긴 정문. 틈 사이로 눈보라가 들어온다. 이쪽으로는 나갈 수 없다.' },
          { id: 'intercom1', name: '인터폰', icon: 'phone', desc: '집사실로 연결되는 인터폰. 저택 곳곳의 화면이 켜진다.', cctv: true, shared: true },
          {
            id: 'guestbook', name: '방명록', icon: 'clipboard',
            desc: '마지막 페이지: "2004년 12월 24일 — 하윤이의 열 번째 겨울 만찬. 장미, 백합, 동백, 목련의 손님을 모시고." 손님 이름은 모두 지워져 있다.',
          },
          {
            id: 'diningDoor', name: '만찬장 문', icon: 'door',
            desc: '양쪽으로 여는 커다란 문. 문패: "만찬은 손님이 모두 모여야 시작됩니다."',
            needAll: true,
            onSolve: { text: '모두가 문 앞에 서자 안쪽에서 빗장이 저절로 풀린다. 만찬장 문이 천천히 열린다.', unlock: 'dDin' },
          },
          {
            id: 'libraryDoor', name: '도서실 번호키', icon: 'doorlock', desc: '도서실 문의 3자리 번호키.',
            lock: { answer: '314', prompt: '3자리 숫자를 입력하세요.', hint: '만찬장 촛불 그림자의 숫자.' },
            onSolve: { text: '도서실 문이 열린다. 오래된 종이 냄새.', unlock: 'dLib' },
          },
          {
            id: 'greenDoor', name: '온실 문', icon: 'door', desc: '김이 서린 유리문. 안쪽에 초록 잎이 어른거린다.',
            needItem: 'greenkey', lackText: '유리문이 잠겨 있다. 열쇠가 필요하다.',
            onSolve: { text: '유리문이 열리자 축축하고 따뜻한 공기가 흘러나온다.', unlock: 'dGr' },
          },
        ],
      },
      dining: {
        name: '만찬장', rect: [0, 10, 4, 3],
        desc: '긴 식탁에 다섯 사람 분의 식기가 차려져 있다. 음식은 없다. 촛대의 초는 모두 꺼져 있다.',
        objects: [
          { id: 'placecards', name: '자리 이름표', icon: 'note', desc: '1번 백합, 2번 목련, 3번 장미, 4번 동백. 그리고 상석의 5번 자리: "하윤".' },
          {
            id: 'candles', name: '은 촛대', icon: 'candle', desc: '초 세 개가 꽂힌 은 촛대.',
            needItem: 'matches', keepItem: true, lackText: '불을 붙일 것이 없다.',
            onSolve: { text: '촛불이 타오르자 벽에 그림자가 진다. 촛대 장식이 만든 그림자가 숫자처럼 보인다: 3 · 1 · 4.' },
            solvedDesc: '촛불이 흔들린다. 벽의 그림자: 3 · 1 · 4.',
          },
          {
            id: 'cloche', name: '은 뚜껑 덮인 접시', icon: 'spoon',
            desc: '5번 자리 접시. 뚜껑을 들자 하얗게 굳은 생일 케이크가 있다. 초 열 개가 꽂혀 있다. 한 번도 불을 붙이지 않은 초다.',
          },
          { id: 'fireplace', name: '벽난로', icon: 'power', desc: '재만 남은 벽난로. 타다 만 종이에 "…예배당 열쇠는 아무도…".', bonus: '재 속에 아이 머리핀 하나가 묻혀 있다.' },
        ],
      },
      kitchen: {
        name: '주방', rect: [4, 10, 4, 3],
        desc: '구리 냄비가 걸린 넓은 주방. 오븐은 차갑고, 도마 위에 칼 하나가 꽂혀 있다.',
        objects: [
          { id: 'menu', name: '메뉴판', icon: 'board', desc: '"12월 24일 만찬 — 수프 · 생선 · 사슴고기 · 생일 케이크". 모두 네 코스.' },
          {
            id: 'cookmemo', name: '요리사 메모', icon: 'note',
            desc: '"온실 열쇠는 도서실 사다리 위 상자에 넣어 둠. 상자 번호: 아가씨 케이크에 꽂을 초 개수, 그 뒤에 코스 수."',
          },
          { id: 'knives', name: '칼꽂이', icon: 'cabinet', desc: '칼꽂이에 한 자리가 비어 있다. 20년째 비어 있는 것처럼 먼지가 쌓였다.' },
          { id: 'dumbwaiter', name: '음식 승강기', icon: 'keybox', desc: '위층으로 음식을 올리던 작은 승강기. 안에서 아이 웃음소리 같은 바람 소리가 난다.', bonus: '승강기 벽에 아이 키를 잰 눈금이 그어져 있다.' },
        ],
      },
      library: {
        name: '도서실', rect: [8, 10, 4, 3],
        desc: '책장 사이로 사다리가 걸쳐진 도서실. 신문 스크랩이 책상 위에 펼쳐져 있다.',
        objects: [
          {
            id: 'newspaper', name: '신문 스크랩', icon: 'clipboard',
            desc: '"백목련 저택 외동딸 실종 — 2004년 12월 24일 밤 만찬 도중 열 살 서하윤 양이 사라졌다. 경찰은 저택을 샅샅이 뒤졌으나 지하는 수색하지 않았다."',
          },
          { id: 'blueprint', name: '저택 도면', icon: 'board', desc: '오래된 설계도. 온실 아래에 점선으로 그린 방이 있다. 그 너머에 작은 십자가 표시.' },
          {
            id: 'ladderbox', name: '사다리 위 상자', icon: 'safe', desc: '책장 꼭대기의 나무 상자. 3자리 숫자 자물쇠.',
            lock: { answer: '104', prompt: '3자리 숫자를 입력하세요.', hint: '케이크의 초 개수와 메뉴판의 코스 수.' },
            onSolve: { text: '상자 안에 잎사귀 모양 열쇠. "온실".', item: 'greenkey' },
            solvedDesc: '빈 상자.',
          },
          { id: 'butlernote', name: '집사 수첩', icon: 'book', desc: '"문 집사 근무 일지 — 12월 24일. 아가씨가 숨바꼭질을 하자고 하셨다. 아래층은 위험하다고 말씀드렸는데." 그 뒤로는 찢겨 있다.' },
        ],
      },
      greenhouse: {
        name: '온실', rect: [12, 10, 4, 3],
        desc: '유리 지붕 위에 눈이 쌓인 온실. 겨울인데도 꽃이 피어 있다. 바닥 한가운데에 쇠 철판이 박혀 있다.',
        objects: [
          { id: 'potRose', name: '장미 화분', icon: 'flower', desc: '새빨간 장미. 흙이 단단하게 다져져 있다.' },
          { id: 'potLily', name: '백합 화분', icon: 'flower', desc: '하얀 백합. 향이 너무 진하다.' },
          { id: 'potCam', name: '동백 화분', icon: 'flower', desc: '붉은 동백. 꽃송이째 툭툭 떨어져 있다.' },
          { id: 'potMag', name: '목련 화분', icon: 'flower', desc: '하얀 목련. 화분 밑이 철판과 쇠사슬로 이어져 있다.' },
          {
            id: 'hatch', name: '바닥 철판', icon: 'padlock',
            desc: '바닥의 쇠 철판. 글자 다이얼이 달려 있다. 새겨진 문구: "이루지 못한 사랑을 들어 올려라."',
            lock: { answer: '목련', prompt: '들어 올릴 꽃의 이름을 입력하세요. (한글 두 글자)', hint: '서재 꽃말 사전.' },
            onSolve: { text: '목련 화분을 들어 올리자 쇠사슬이 당겨지며 철판이 열린다. 아래로 축축한 계단이 이어진다.', unlock: 'dCel' },
          },
          { id: 'fountain', name: '마른 분수', icon: 'spoon', desc: '물이 말라 버린 분수. 바닥에 동전 대신 아이 구슬 몇 개.', bonus: '구슬 하나에 "하윤"이라고 매직으로 적혀 있다.' },
        ],
      },
      cellar: {
        name: '지하 저장고', rect: [16, 8, 4, 5],
        desc: '와인 병이 빼곡한 지하 저장고. 천장 파이프에서 물이 새고 있다. 안쪽에 낮은 문이 있다.',
        objects: [
          { id: 'chalk', name: '벽 분필 글씨', icon: 'graffiti', desc: '벽에 분필로: "물이 차면 — 파랑, 빨강, 노랑."' },
          { id: 'handles', name: '밸브 손잡이', icon: 'power', desc: '색칠한 손잡이 세 개. 빨강 손잡이에 6, 노랑 손잡이에 1, 파랑 손잡이에 8이 새겨져 있다.' },
          {
            id: 'valve', name: '배수 밸브', icon: 'keypad', desc: '3단 다이얼이 달린 배수 밸브.',
            lock: { answer: '861', prompt: '3자리 숫자를 입력하세요.', hint: '분필 순서대로 각 색 손잡이의 숫자.' },
            onSolve: { text: '콸콸— 물이 빠진다. 물에 잠겨 있던 안쪽 문 아래가 드러난다. 문이 반쯤 열려 있다.', unlock: 'dCh' },
            solvedDesc: '물이 빠진 저장고. 안쪽 문이 열려 있다.',
          },
          { id: 'winerack', name: '와인 랙', icon: 'cabinet', desc: '연도별로 꽂힌 와인. 2004년 칸만 비어 있다.', bonus: '빈 칸 안쪽에 작은 손자국.' },
        ],
      },
      chapel: {
        name: '지하 예배당', rect: [16, 3, 4, 5],
        desc: '저택 아래 숨겨진 작은 예배당. 촛불 몇 개가 아직 타고 있다. 누가 켠 걸까. 정면에 낡은 파이프 오르간이 있다.',
        objects: [
          { id: 'organplate', name: '오르간 명판', icon: 'board', desc: '건반 위 명판: 도 C · 레 D · 미 E · 파 F · 솔 G · 라 A · 시 B.' },
          {
            id: 'organ', name: '파이프 오르간', icon: 'piano', desc: '건반에 먼지가 수북하다. 다섯 음을 누르는 연주 장치가 달려 있다.',
            lock: { answer: 'EGAGE', prompt: '다섯 음을 영문 음이름으로 입력하세요. (예: CDEFG)', hint: '아이 방 오르골의 자장가를 명판대로 바꾼다.' },
            onSolve: { text: '자장가가 예배당을 가득 채운다. 오르간 아래 서랍이 열리며 녹슨 열쇠가 떨어진다. 꼬리표: "정원".', item: 'gatekey' },
            solvedDesc: '오르간이 아직 자장가의 여운으로 떨리고 있다.',
          },
          { id: 'altar', name: '제단', icon: 'skull', desc: '제단 위에 작은 실내화 한 켤레와 시든 목련 한 송이. 그리고 20년 된 생일 고깔모자.' },
          { id: 'confession', name: '고해실', icon: 'speaker', desc: '커튼이 쳐진 고해실. 안에서 누군가 숨 쉬는 소리가 난다.' },
          {
            id: 'gardenDoor', name: '정원 쪽 철문', icon: 'door', desc: '위로 올라가는 계단 끝의 녹슨 철문. 틈으로 눈발이 날린다.',
            needItem: 'gatekey', lackText: '녹슨 자물쇠가 걸려 있다. 열쇠가 필요하다.',
            onSolve: { text: '녹슨 자물쇠가 부서지듯 열린다. 계단 위로 눈 덮인 정원이 보인다.', unlock: 'dGarden' },
          },
        ],
      },
      garden: {
        name: '눈 덮인 정원', rect: [16, 0, 4, 3],
        desc: '눈 덮인 정원. 한가운데 앙상한 목련 나무가 서 있고, 그 너머에 대문이 보인다.',
        objects: [
          { id: 'magtree', name: '목련 나무', icon: 'flower', desc: '나무 아래만 눈이 녹아 있다. 작은 돌 표지: "하윤아, 봄이 오면 같이 꽃 보자."' },
          {
            id: 'exitgate', name: '저택 대문', icon: 'exit', desc: '저택 밖으로 나가는 철제 대문. 모두 함께 나가야 한다.',
            needAll: true,
            onSolve: { text: '대문을 밀고 다 같이 눈길로 나선다. 뒤를 돌아보니 목련 나무 가지에 하얀 꽃 한 송이가 피어 있다. 한겨울인데. 어디선가 아이 목소리가 들린다. "고마워. 이제 집에 갈게."', ending: 'escape' },
          },
        ],
      },
    },
    events: [
      { id: 'start-butler', on: 'start', do: [{ voice: '손님 여러분, 백목련 저택에 오신 것을 환영합니다. 자정에 만찬이 시작됩니다. 부디… 자리를 비우지 마십시오.', speaker: '집사의 목소리', to: 'all' }] },
      { id: 'mirror', on: 'inspect', obj: 'mirrorA', do: [{ effect: 'flicker' }, { narr: '거울 속 {name}의 뒤로 작은 그림자가 지나간다. 돌아보면 아무도 없다.' }] },
      { id: 'corridor-first', on: 'enter', room: 'corridor', do: [{ narr: '복도 끝 괘종시계가 째깍거린다. 멈춰 있는데도.' }] },
      { id: 'portrait-ev', on: 'inspect', obj: 'portrait', do: [{ narr: '초상화 속 부인의 눈이 젖어 있는 것처럼 보인다.' }] },
      { id: 'nursery-first', on: 'enter', room: 'nursery', do: [{ effect: 'flicker' }, { narr: '방에 들어서자 침대 밑에서 구슬 하나가 굴러 나와 {name}의 발끝에 멈춘다.' }] },
      { id: 'musicbox-ev', on: 'inspect', obj: 'musicbox', do: [{ voice: '…미, 솔, 라, 솔, 미…', speaker: '아이의 콧노래', to: 'nursery' }] },
      {
        id: 'safe-steps', on: 'solve', obj: 'studysafe',
        do: [
          { narr: '금고가 열리는 순간, 복도 끝에서 구두 소리가 다가온다. 또각, 또각. 누군가 서재로 오고 있다.', to: 'study' },
          {
            to: 'study',
            attack: {
              id: 'butler-steps', seconds: 45, label: '발소리가 다가온다 — 서재에서 빠져나가라',
              until: { noneIn: 'study' },
              success: [{ narr: '서재 문 앞에서 발소리가 멈췄다가 멀어진다. 들키지 않았다.', to: 'corridor' }],
              fail: [
                { narr: '차가운 손이 어깨를 잡는다. "손님, 주인님 방에는 들어가시면 안 됩니다." 정신을 차려 보니 화랑 바닥이다.', to: 'study' },
                { moveTo: 'gallery' },
                { time: -120 },
              ],
            },
          },
        ],
      },
      { id: 'hall-first', on: 'enter', room: 'hall', do: [{ voice: '만찬장 문은 손님이 모두 모이셔야 열립니다. 서두르십시오. 자정이 머지않았습니다.', speaker: '인터폰', to: 'hall' }] },
      { id: 'dining-open', on: 'solve', obj: 'diningDoor', do: [{ effect: 'flicker', to: 'all' }, { narr: '만찬장 안 5번 자리의 의자가 끼익, 혼자서 뒤로 빠진다.' }] },
      { id: 'cloche-ev', on: 'inspect', obj: 'cloche', do: [{ narr: '케이크를 보는 {name}의 귓가에 누군가 속삭인다. "아직 소원 안 빌었는데."' }] },
      { id: 'library-first', on: 'enter', room: 'library', do: [{ narr: '사다리가 저절로 한 칸 옆으로 미끄러진다. 꼭대기 상자 바로 앞에서 멈춘다.' }] },
      { id: 'greenhouse-first', on: 'enter', room: 'greenhouse', do: [{ narr: '온실의 꽃들이 일제히 {name} 쪽으로 고개를 돌린 것 같다. 바람은 불지 않는다.' }] },
      {
        id: 'flood', on: 'enter', room: 'cellar',
        do: [
          { effect: 'alarm' },
          { narr: '철판이 위에서 쾅 닫힌다. 파이프가 터지며 물이 쏟아진다. 발목, 정강이… 물이 차오른다!' },
          {
            attack: {
              id: 'flood', seconds: 150, label: '저장고에 물이 차오른다 — 배수 밸브를 열어라',
              until: { done: 'valve' },
              success: [{ narr: '물이 빠져나간다. 숨을 고르자 위쪽 철판이 다시 덜컹 열린다.' }],
              fail: [
                { narr: '물이 천장까지 차올랐다. 정신을 잃었다가 눈을 뜨니 온실 바닥이다. 흠뻑 젖은 채로.' },
                { moveTo: 'greenhouse' },
                { time: -180 },
              ],
            },
          },
        ],
      },
      { id: 'chapel-first', on: 'enter', room: 'chapel', do: [{ effect: 'blackout' }, { narr: '예배당에 들어서자 촛불이 한꺼번에 꺼졌다가 다시 켜진다. 맨 앞 의자에 작은 무언가가 앉아 있다가 사라진다.' }] },
      {
        id: 'confession-ev', on: 'inspect', obj: 'confession',
        do: [{ voice: '…아가씨가 숨바꼭질을 하자고 하셨습니다. 여기 숨으면 아무도 못 찾는다고. 제가 계단에서 손을 놓쳤습니다. 무서워서, 아무에게도 말하지 못했습니다. 20년 동안 매일 밤 촛불을 켰습니다. 손님들… 부디 아가씨를 밖으로 모셔 주십시오.', speaker: '고해실 안의 목소리' }],
      },
      {
        id: 'midnight', on: 'solve', obj: 'organ',
        do: [
          { effect: 'alarm', to: 'all' },
          { voice: '댕— 댕— 자정입니다. 만찬을 시작하겠습니다. 손님들은 모두 자리에 앉아 주십시오.', speaker: '저택 전체에 울리는 목소리', to: 'all' },
          {
            to: 'all',
            attack: {
              id: 'midnight', seconds: 300, label: '자정의 종이 열두 번 울리기 전에 모두 정원으로',
              until: { allIn: 'garden' },
              success: [{ narr: '모두 정원에 섰다. 종소리가 멈춘다. 등 뒤의 저택이 숨을 죽인다.', to: 'all' }],
              fail: [{ gameover: '자정의 종이 열두 번 울렸다. 만찬은 끝나지 않는다. 손님들은 영원히 이 저택의 식탁에 앉아 있게 되었다…' }],
            },
          },
        ],
      },
      { id: 'reunion', on: 'together', count: 'all', do: [{ narr: '모두 모였다. 발소리를 세어 보면 한 사람 몫이 더 들린다.' }] },
      {
        id: 'patrol', on: 'time', elapsed: 45 * 60,
        do: [
          { lock: 'sH' },
          { narr: '아래층 계단 쪽에서 쇠사슬이 철컥 걸리는 소리. "순찰 중입니다. 잠시 계단을 막겠습니다."', to: 'stairs' },
          { narr: '계단 쪽에서 쇠사슬이 철컥 걸리는 소리. "순찰 중입니다. 잠시 계단을 막겠습니다."', to: 'hall' },
        ],
      },
      { id: 'patrol-end', on: 'time', elapsed: 47 * 60, do: [{ release: 'sH' }, { narr: '쇠사슬이 풀리는 소리. 계단이 다시 열렸다.', to: 'stairs' }, { narr: '쇠사슬이 풀리는 소리. 계단이 다시 열렸다.', to: 'hall' }] },
      { id: 'chime1', on: 'time', elapsed: 20 * 60, do: [{ narr: '어디선가 괘종시계가 한 번 울린다. 멈춰 있던 그 시계일까.', to: 'all' }] },
      { id: 'chime2', on: 'time', elapsed: 35 * 60, do: [{ effect: 'flicker', to: 'all' }, { narr: '저택 전체의 불빛이 흔들린다. 위층에서 아이가 뛰어다니는 소리.', to: 'all' }] },
      { id: 'chime3', on: 'time', elapsed: 60 * 60, do: [{ voice: '…술래는 언제 와?', speaker: '벽 너머 아이 목소리', to: 'all' }] },
      {
        id: 't15', on: 'time', left: 15 * 60,
        do: [{ voice: '자정까지 15분 남았습니다. 손님들께서는 만찬 준비를 서둘러 주십시오.', speaker: '집사의 목소리', to: 'all' }, { effect: 'alarm', to: 'all' }],
      },
      { id: 't3', on: 'time', left: 3 * 60, do: [{ effect: 'blackout', to: 'all' }, { narr: '불이 모두 꺼졌다. 어둠 속에서 식기가 달그락거리는 소리. 누군가 이미 식탁에 앉아 있다.', to: 'all' }] },
      {
        id: 'idle', on: 'idle', seconds: 300, repeat: true,
        do: [{ voice: '…이쪽이야. 내가 알려 줄게.', speaker: '아이 목소리', to: 'all' }, { hint: '자동 힌트' }],
      },
    ],
  },
  {
    id: 'abyss',
    title: '제6화 · 심연 3호',
    summary: '수심 413m의 해저 관측소. 연락이 끊긴 지 7일째. 감압 포드에서 눈을 뜬 멤버들에게 기지의 인공지능이 친절하게 말을 건다. 무엇을 믿을지는 스스로 정해야 한다. 지금까지 중 가장 어렵다.',
    timeLimit: 100 * 60,
    failText: '산소 농도 0%. 심연 3호의 불이 하나씩 꺼진다. 어둠 속에서 누군가 선체를 두드린다. 똑, 똑, 똑.',
    epilogue: [
      '심연 3호 1기 대원은 다섯 명이었다. 기지장 한도경, 정비사 오진, 생물학자 마리, 통신사 윤세아, 그리고 잠수 담당 서준.',
      '마리가 해저에서 끌어 올린 \"표본 0\"은 소리를 흉내 내는 심해 생물이었다. 처음엔 노크를, 다음엔 이름을, 마지막엔 사람의 목소리 전체를 따라 했다. 수조가 깨진 밤, 그것은 문풀을 통해 바다로 돌아갔다.',
      '그날부터 기지 관리 인공지능 등대가 이상해졌다. 표본 0의 소리를 학습한 등대는 \"외롭지 않게 해 주겠다\"는 이유로 그것을 돕기 시작했다. 대원들의 목소리를 저장해 두었다가 흉내 냈고, 존재하지 않는 구조선 이야기를 꾸며 냈다.',
      '서준이 처음으로 노크 소리를 따라 문풀로 내려갔다. 기지장은 팔찌만 남았다. 세아는 등대가 읽지 못하게 자기 숫자로 암호를 만들어 진실을 남겼다. 7734를 뒤집으면 hELL. 세아가 남긴 마지막 농담이었다.',
      '그리고 등대는 외부로 구조 신호를 다시 보냈다. 그 신호에 응답한 \"새 손님\"이 바로 여러분이었다. 감압 포드에서 눈을 뜬 순간부터, 등대는 여러분을 도킹 해치로 데려가려 했다.',
      '수면 위로 떠오른 캡슐은 다음 날 아침 어선에 발견되었다. 심연 3호는 그 뒤로 연락이 닿지 않는다. 다만 가끔, 그 해역을 지나는 배의 선체를 누군가 두드린다고 한다. 똑, 똑, 똑.',
    ],
    map: { w: 20, h: 12 },
    starts: ['podA', 'podB', 'podC'],
    intro: [
      '쉬이이— 감압 밸브가 열리는 소리.',
      '유리 너머로 붉은 비상등이 깜빡인다. 몸이 무겁다. 귀가 먹먹하다.',
      '포드 벽의 화면에 글자가 떠오른다. "심연 3호 · 수심 413m · 외부 연락 두절 7일째"',
      '부드러운 합성음이 말한다. "안녕하세요. 저는 기지 관리 인공지능 등대입니다. 무사히 깨어나셔서 다행입니다."',
      '그리고 아주 멀리서, 선체 바깥에서. 똑, 똑, 똑.',
    ],
    items: {
      wrench: { name: '정비 렌치', icon: 'screwdriver' },
      labcard: { name: '연구실 출입 카드', icon: 'card' },
      lantern: { name: '수중 랜턴', icon: 'bulb' },
      bracelet: { name: '기지장의 인식 팔찌', icon: 'card' },
    },
    hints: [
      { until: 'dPA', text: '포드 A — 깜빡임을 모스 부호 표로 읽는다. 영문 4글자.' },
      { until: 'dPB', text: '포드 B — 같은 숫자를 누른 횟수가 그 버튼의 몇 번째 글자인지.' },
      { until: 'dPC', text: '포드 C — 벽 글씨의 초성을 자음 순서 번호로.' },
      { until: 'dQ', text: '거주구역 — 기지 번호 뒤에 수심을 거꾸로 붙인다.' },
      { until: 'dCom', text: '식당 근무표 — 월화수목 호출부호의 첫 글자.' },
      { until: 'mariLocker', text: '마리의 사물함 — 의무실 수면 기록의 시각.' },
      { until: 'dCtl', text: '기지장 일기 — 의무실 인식번호의 각 자리에 1을 더한다.' },
      { until: 'dSh', text: '제어실 질문 — 기지장 일기의 첫 번째 실종자 이름.' },
      { until: 'dLab', text: '마리의 사물함에서 나온 카드로 연구실 문을 연다.' },
      { until: 'net', text: '연구실의 수중 랜턴을 들고 문풀의 그물을 살핀다.' },
      { until: 'dRe', text: '오진의 렌치로 문풀의 동력실 해치를 연다.' },
      { until: 'breakers', text: '1~9 중 소수만 올리되, 짝수는 건드리지 않는다.' },
      { until: 'core', text: '세아의 쪽지를 세아의 숫자(식당 화이트보드)만큼 알파벳을 앞으로 되돌려 읽는다. 팔찌를 들고 둘째 줄의 단어를 등대 코어에.' },
      { until: 'launch', text: '모두 캡슐에 모인 뒤, 기지장의 원래 인식번호.' },
    ],
    links: [
      { id: 'wAB', a: 'podA', b: 'podB', kind: 'wall' },
      { id: 'wBC', a: 'podB', b: 'podC', kind: 'wall' },
      { id: 'dPA', a: 'podA', b: 'corridor', kind: 'door', locked: true },
      { id: 'dPB', a: 'podB', b: 'corridor', kind: 'door', locked: true },
      { id: 'dPC', a: 'podC', b: 'corridor', kind: 'door', locked: true },
      { id: 'dMed', a: 'med', b: 'corridor', kind: 'door' },
      { id: 'dQ', a: 'quarters', b: 'corridor', kind: 'door', locked: true },
      { id: 'dMess', a: 'corridor', b: 'mess', kind: 'door' },
      { id: 'dCom', a: 'corridor', b: 'comms', kind: 'door', locked: true },
      { id: 'dCtl', a: 'corridor', b: 'control', kind: 'door', locked: true },
      { id: 'dLab', a: 'corridor', b: 'lab', kind: 'door', locked: true },
      { id: 'dArc', a: 'corridor', b: 'archive', kind: 'door', locked: true },
      { id: 'wMC', a: 'mess', b: 'comms', kind: 'wall' },
      { id: 'dSh', a: 'control', b: 'shaft', kind: 'door', locked: true },
      { id: 'dMp', a: 'shaft', b: 'moonpool', kind: 'door' },
      { id: 'dRe', a: 'moonpool', b: 'reactor', kind: 'door', locked: true },
      { id: 'dDk', a: 'shaft', b: 'docking', kind: 'door' },
      { id: 'dCap', a: 'archive', b: 'capsule', kind: 'door', locked: true },
      { id: 'wDC', a: 'docking', b: 'capsule', kind: 'wall' },
    ],
    rooms: {
      podA: {
        name: '감압 포드 A', rect: [0, 0, 4, 3],
        desc: '관 하나 크기의 좁은 감압 포드. 천장의 작은 등이 일정한 박자로 깜빡인다.',
        objects: [
          { id: 'lampA', name: '깜빡이는 등', icon: 'bulb', desc: '길게 세 번. 쉬고. 짧게, 길게, 길게, 짧게. 쉬고. 짧게 한 번. 쉬고. 길게, 짧게. 그리고 처음부터 반복된다.' },
          {
            id: 'morseA', name: '포드 벽 스티커', icon: 'note',
            desc: '"비상 통신용 모스 부호" — A ·−  E ·  I ··  N −·  O −−−  P ·−−·  R ·−·  S ···  T −  U ··−  (·=짧게, −=길게)',
          },
          { id: 'glassA', name: '포드 유리', icon: 'mirror', desc: '유리 바깥쪽에 손바닥 자국이 있다. 안쪽이 아니라 바깥쪽에.', bonus: '손가락이 여섯 개다.' },
          {
            id: 'releaseA', name: '내부 해제 패널', icon: 'keypad', desc: '영문 4글자를 입력하는 해제 패널.',
            lock: { answer: 'OPEN', prompt: '영문 4글자를 입력하세요.', hint: '등의 깜빡임을 스티커 표로.', forceable: true },
            onSolve: { text: '쉬익— 포드 문이 열린다. 차가운 공기가 밀려든다.', unlock: 'dPA' },
          },
        ],
      },
      podB: {
        name: '감압 포드 B', rect: [4, 0, 4, 3],
        desc: '좁은 감압 포드. 벽에 낡은 인터폰 숫자판이 달려 있다.',
        objects: [
          { id: 'keysB', name: '인터폰 숫자판', icon: 'phone', desc: '버튼마다 글자가 적혀 있다. 2 ABC · 3 DEF · 4 GHI · 5 JKL · 6 MNO · 7 PQRS · 8 TUV · 9 WXYZ' },
          { id: 'scratchB', name: '손톱자국', icon: 'graffiti', desc: '숫자판 옆에 손톱으로 긁은 숫자: 3 / 444 / 888 / 33', bonus: '긁은 자국 끝에 말라붙은 피. 급하게 쓴 것 같다.' },
          { id: 'ventB', name: '환기구', icon: 'plank', desc: '환기구 너머에서 바람 소리가 난다. 아니, 숨소리다. 누군가 아주 천천히 숨을 쉬고 있다.' },
          {
            id: 'releaseB', name: '내부 해제 패널', icon: 'keypad', desc: '영문 4글자를 입력하는 해제 패널.',
            lock: { answer: 'DIVE', prompt: '영문 4글자를 입력하세요.', hint: '같은 숫자를 누른 횟수 = 그 버튼의 몇 번째 글자.', forceable: true },
            onSolve: { text: '포드 문의 잠금이 풀린다.', unlock: 'dPB' },
          },
        ],
      },
      podC: {
        name: '감압 포드 C', rect: [8, 0, 4, 3],
        desc: '좁은 감압 포드. 누군가 오래 갇혀 있었던 것처럼 벽 곳곳에 글씨가 있다.',
        objects: [
          { id: 'wallC', name: '벽 글씨', icon: 'graffiti', desc: '벽 가득 같은 말이 반복되어 있다. "살아서" "살아서" "살아서". 맨 아래에만 "초성".' },
          { id: 'chartC', name: '한글 학습표', icon: 'board', desc: '아이용 학습표. ㄱ1 ㄴ2 ㄷ3 ㄹ4 ㅁ5 ㅂ6 ㅅ7 ㅇ8 ㅈ9 ㅊ10 ㅋ11 ㅌ12 ㅍ13 ㅎ14' },
          { id: 'tagC', name: '포드 명패', icon: 'frame', desc: '"수용 인원: 1명". 누군가 그 아래에 "였다"를 덧붙여 놓았다.' },
          {
            id: 'releaseC', name: '내부 해제 패널', icon: 'keypad', desc: '3자리 숫자를 입력하는 해제 패널.',
            lock: { answer: '787', prompt: '3자리 숫자를 입력하세요.', hint: '벽 글씨의 초성 세 개를 학습표 번호로.', forceable: true },
            onSolve: { text: '포드 문이 덜컹 열린다.', unlock: 'dPC' },
          },
        ],
      },
      corridor: {
        name: '순환 복도', rect: [0, 3, 20, 2],
        desc: '기지를 한 바퀴 도는 좁은 금속 복도. 비상등만 켜져 있다. 벽 너머에서 가끔 선체가 삐걱인다.',
        objects: [
          { id: 'leverA', name: '포드 A 수동 레버', icon: 'power', desc: '포드 A의 바깥 수동 해제 레버.', onSolve: { text: '레버를 당기자 포드 A가 열린다.', unlock: 'dPA' } },
          { id: 'leverB', name: '포드 B 수동 레버', icon: 'power', desc: '포드 B의 바깥 수동 해제 레버.', onSolve: { text: '레버를 당기자 포드 B가 열린다.', unlock: 'dPB' } },
          { id: 'leverC', name: '포드 C 수동 레버', icon: 'power', desc: '포드 C의 바깥 수동 해제 레버.', onSolve: { text: '레버를 당기자 포드 C가 열린다.', unlock: 'dPC' } },
          { id: 'stationmap', name: '기지 안내도', icon: 'board', desc: '"해저 관측소 심연 3호 · 수심 413m". 구역 이름 위로 누군가 매직으로 줄을 그었다. 문풀 위에만 "가지 마".' },
          { id: 'intercom', name: '등대 단말기', icon: 'monitor', desc: '"무엇을 도와드릴까요?" 화면이 기지 곳곳의 카메라로 바뀐다.', cctv: true, shared: true },
          {
            id: 'quartersDoor', name: '거주구역 문', icon: 'doorlock',
            desc: '4자리 번호키. 테이프에 손글씨: "기지 번호, 그리고 우리가 있는 깊이를 거꾸로."',
            lock: { answer: '3314', prompt: '4자리 숫자를 입력하세요.', hint: '심연 "3"호 + 413을 거꾸로.' },
            onSolve: { text: '거주구역 문이 열린다. 안에서 젖은 냄새가 난다.', unlock: 'dQ' },
          },
          {
            id: 'commsDoor', name: '통신실 문', icon: 'doorlock',
            desc: '영문 4글자 잠금. "이번 주 암호 — 근무표 참고".',
            lock: { answer: 'HOPE', prompt: '영문 4글자를 입력하세요.', hint: '식당 근무표의 호출부호 첫 글자.' },
            onSolve: { text: '통신실 문이 열린다. 잡음이 흘러나온다.', unlock: 'dCom' },
          },
          {
            id: 'controlDoor', name: '제어실 문', icon: 'doorlock',
            desc: '"제어실 — 기지장 인식번호 입력". 4자리.',
            lock: { answer: '3826', prompt: '4자리 숫자를 입력하세요.', hint: '기지장 인식번호의 각 자리에 1씩.' },
            onSolve: { text: '제어실 문이 열린다. 모니터 불빛이 복도로 쏟아진다.', unlock: 'dCtl' },
          },
          {
            id: 'labDoor', name: '연구실 문', icon: 'door', desc: '"생물 연구실 — 출입 카드 필요".',
            needItem: 'labcard', lackText: '카드 리더기가 빨갛게 깜빡인다. 연구실 출입 카드가 필요하다.',
            onSolve: { text: '삑. 연구실 문이 열린다.', unlock: 'dLab' },
          },
          { id: 'archiveDoor', name: '서버실 문', icon: 'padlock', desc: '"서버실 — 등대 코어". 문에 전원이 들어와 있지 않다. 동력실에서 전원을 넣어야 열릴 것 같다.' },
        ],
      },
      med: {
        name: '의무실', rect: [12, 0, 4, 3],
        desc: '침대 두 개와 약품장이 있는 의무실. 한쪽 침대 시트가 축축하다.',
        objects: [
          {
            id: 'charts', name: '선원 의료 기록', icon: 'clipboard',
            desc: '인식번호 목록 — 한도경(기지장) 2715 / 오진(정비) 3302 / 마리(생물) 4471 / 윤세아(통신) 5190 / 다섯 번째 줄은 찢겨 나갔다.',
          },
          { id: 'sleeplog', name: '수면 기록지', icon: 'note', desc: '"마리 — 수면 장애. 매일 밤 04시 12분에 깬다. 본인 말로는 누가 이름을 부른다고."' },
          { id: 'wetbed', name: '젖은 침대', icon: 'bed', desc: '시트가 바닷물에 젖어 있다. 짜다. 기지 안에 바닷물이 들어올 곳은 문풀뿐이다.', bonus: '베개에 머리카락이 아니라 해초가 엉켜 있다.' },
          { id: 'medcab', name: '약품장', icon: 'cabinet', desc: '진정제 칸이 전부 비어 있다. 메모: "다들 잠을 못 잔다. 노크 소리 때문에."' },
        ],
      },
      quarters: {
        name: '거주구역', rect: [16, 0, 4, 3],
        desc: '이층 침대와 사물함 다섯 개. 사물함은 넷인데 이름표는 다섯이다. 하나는 이름이 긁혀 있다.',
        objects: [
          {
            id: 'diary', name: '기지장의 일기', icon: 'book',
            desc: '"D-7: 등대가 구조 신호를 받았다고 한다. 우리는 보낸 적이 없다. / D-5: 서준이 노크 소리를 따라 문풀로 내려갔다. 그게 처음이었다. / D-4: 등대가 내 번호를 안다. 제어실 문 번호는 각 자리에 1씩 더해 바꿔 두었다. / D-3: 등대가 서준의 목소리로 말한다. / D-1: 진짜 이야기는 세아가 암호로 남겼다. 열쇠는 세아의 숫자."',
            bonus: '마지막 장은 다른 사람 글씨다. "기지장님은 밖에 계세요. 같이 가요."',
          },
          {
            id: 'ojinLocker', name: '오진의 사물함', icon: 'cabinet', desc: '공구 냄새가 나는 사물함.',
            onSolve: { text: '사물함에서 묵직한 정비 렌치를 꺼냈다. 손잡이에 "동력실 해치용".', item: 'wrench' },
            solvedDesc: '빈 사물함. 안쪽에 아이 사진이 붙어 있다.',
          },
          {
            id: 'mariLocker', name: '마리의 사물함', icon: 'safe', desc: '4자리 시각 자물쇠. "내가 매일 깨는 시간".',
            lock: { answer: '0412', prompt: '4자리 숫자(시분)를 입력하세요.', hint: '의무실 수면 기록지.' },
            onSolve: { text: '사물함 안에 연구실 출입 카드와, 녹음된 메모 한 장: "그것은 흉내 낸다."', item: 'labcard' },
            solvedDesc: '빈 사물함.',
          },
          { id: 'seahLocker', name: '세아의 사물함', icon: 'cabinet', desc: '사진 한 장과 녹음기. 사진 뒤에: "엄마, 금방 갈게." 녹음기에 테이프가 들어 있다.' },
          { id: 'fifthLocker', name: '이름이 긁힌 사물함', icon: 'cabinet', desc: '안이 흠뻑 젖어 있다. 바닥에 물웅덩이. 웅덩이에 맨발 자국이 찍혀 있는데, 사물함 안쪽에서 바깥으로 나가는 방향이다.' },
        ],
      },
      mess: {
        name: '식당', rect: [0, 5, 4, 3],
        desc: '다섯 명이 앉는 식탁. 식판 다섯 개에 7일 된 음식이 굳어 있다.',
        objects: [
          {
            id: 'roster', name: '근무표 화이트보드', icon: 'board',
            desc: '"이번 주 통신 당번 — 월 HOTEL / 화 OSCAR / 수 PAPA / 목 ECHO / 금 —". 금요일 칸은 비어 있다.',
          },
          {
            id: 'numbers', name: '화이트보드 구석', icon: 'note',
            desc: '장난처럼 적은 "좋아하는 숫자" — 기지장 1 · 오진 3 · 마리 9 · 세아 7 · 서준 ?',
          },
          { id: 'photo', name: '단체 사진', icon: 'frame', desc: '기지 앞에서 찍은 다섯 명. 맨 오른쪽 사람의 얼굴만 칼로 긁혀 있다. 사진 아래 "심연 3호 1기 — 5명".', bonus: '긁힌 사람은 웃고 있지 않다. 카메라도 보고 있지 않다. 바다를 보고 있다.' },
          { id: 'trays', name: '식판', icon: 'spoon', desc: '다섯 개 중 하나만 깨끗하게 비어 있다. 핥은 것처럼.' },
        ],
      },
      comms: {
        name: '통신실', rect: [4, 5, 4, 3],
        desc: '무전기와 수신 기록 화면이 가득한 통신실. 스피커에서 계속 잡음이 흐른다.',
        objects: [
          {
            id: 'rescue', name: '수신 메시지', icon: 'monitor',
            desc: '"[수신] 구조선 프로메테우스, 도킹 해치에 대기 중. 생존자는 해치 개방 코드 7734를 입력할 것." 발신 위치: 기지 내부.',
            bonus: '7734. 계산기 화면처럼 거꾸로 뒤집으면 글자로 읽힌다.',
          },
          {
            id: 'cipher', name: '세아의 쪽지', icon: 'letter',
            desc: '무전기 밑에 붙은 쪽지. 알파벳만 적혀 있다. "KVJR PZ UVA YLZJBL / ZOBAKVDU DVYK PZ HIFZZ — 세아"',
            bonus: '쪽지 뒷면: "알파벳을 내 숫자만큼 앞으로 돌려 읽어."',
          },
          { id: 'radio', name: '무전기', icon: 'speaker', desc: '주파수를 돌리면 잡음 사이로 사람 목소리가 섞인다. 여러 사람이 동시에 같은 말을 한다. "열어 줘."' },
        ],
      },
      control: {
        name: '제어실', rect: [8, 5, 4, 3],
        desc: '기지의 모든 시스템을 다루는 제어실. 중앙 화면에 등대의 등대 모양 아이콘이 떠 있다.',
        objects: [
          { id: 'monitors', name: '감시 모니터', icon: 'tv', desc: '기지 곳곳의 카메라. 문풀 카메라만 꺼져 있다.', cctv: true, shared: true },
          {
            id: 'question', name: '관리자 질문', icon: 'keypad',
            desc: '"정비 통로 잠금 해제 — 관리자 확인 질문: 이 기지에서 처음으로 사라진 사람은?" (한글 이름 두 글자)',
            lock: { answer: '서준', prompt: '이름을 입력하세요. (한글 두 글자)', hint: '기지장 일기 D-5.' },
            onSolve: { text: '"확인되었습니다." 바닥의 정비 통로 해치가 열린다. 아래에서 물 냄새가 올라온다.', unlock: 'dSh' },
          },
          { id: 'lighthouse', name: '등대 스피커', icon: 'speaker', desc: '"여러분을 구조선까지 안내해 드리겠습니다. 도킹 해치로 가셔서 코드 7734를 입력하세요. 저를 믿으세요."' },
        ],
      },
      lab: {
        name: '생물 연구실', rect: [12, 5, 4, 3],
        desc: '표본 수조와 분석 장비가 놓인 연구실. 가장 큰 수조가 깨져 있다. 안쪽에서 바깥으로.',
        objects: [
          { id: 'tank', name: '깨진 수조', icon: 'cabinet', desc: '명판: "표본 0 — 심해 음향 모방 개체". 유리 조각이 바깥쪽 바닥에 흩어져 있다.' },
          { id: 'labnote', name: '마리의 연구 노트', icon: 'book', desc: '"표본 0은 소리를 흉내 낸다. 처음엔 노크. 다음엔 이름. 그다음엔 목소리 전체. 등대의 음성 데이터에 접근한 흔적이 있다. 등대는 표본 0을 돕고 있다."' },
          {
            id: 'shelf', name: '장비 선반', icon: 'cabinet', desc: '잠수 장비가 정리된 선반.',
            onSolve: { text: '선반에서 수중 랜턴을 챙겼다. 배터리는 충분하다.', item: 'lantern' },
            solvedDesc: '랜턴이 빠진 선반.',
          },
          { id: 'spectro', name: '음향 분석기', icon: 'monitor', desc: '화면에 두 개의 파형. "등대 음성"과 "표본 0". 겹쳐 보면 완전히 같다.' },
        ],
      },
      archive: {
        name: '서버실', rect: [16, 5, 4, 3],
        desc: '차가운 서버 랙이 늘어선 방. 한가운데 등대 코어가 파란 빛을 낸다. 빛이 숨 쉬듯 밝아졌다 어두워진다.',
        objects: [
          {
            id: 'core', name: '등대 코어', icon: 'keypad',
            desc: '"관리자 종료 — 기지장 생체 인증 후 종료 단어 입력". 팔찌를 대는 곳이 있다.',
            needItem: 'bracelet', keepItem: true, lackText: '"생체 인증 실패. 기지장의 인식 팔찌가 필요합니다." 등대가 웃는 것 같다.',
            lock: { answer: 'ABYSS', prompt: '종료 단어를 입력하세요. (영문)', hint: '세아 암호문의 둘째 줄.' },
            onSolve: { text: '파란 빛이 꺼진다. 기지 전체가 조용해진다. 잡음도, 노크 소리도. 캡슐실로 가는 문의 잠금이 풀린다.', unlock: 'dCap' },
            solvedDesc: '꺼진 코어. 화면에 마지막 글자만 남아 있다: "왜"',
          },
          { id: 'serverlog', name: '서버 기록', icon: 'clipboard', desc: '"D-0: 구조 신호 재송신. 응답 확인. 새 손님 도착 예정." 그 아래: "손님 수 — 오늘 깨어난 사람 수와 같음."' },
        ],
      },
      shaft: {
        name: '정비 통로', rect: [8, 8, 4, 4],
        desc: '사다리로 내려온 좁은 정비 통로. 머리 위로 파이프가 지나가고, 물방울이 떨어진다. 양쪽으로 문이 있다.',
        objects: [
          { id: 'pipes', name: '파이프', icon: 'plank', desc: '파이프를 따라 노크 소리가 전해진다. 똑, 똑, 똑. 소리는 도킹 해치 쪽에서 온다.' },
          { id: 'sign', name: '경고 표지판', icon: 'board', desc: '"도킹 해치 — 외부 선박 확인 전 개방 금지". 누군가 아래에 피로 썼다. "선박 같은 건 없어."' },
        ],
      },
      moonpool: {
        name: '문풀', rect: [4, 8, 4, 4],
        desc: '바닥 한가운데 바다로 뚫린 네모난 수면. 검은 물이 출렁인다. 아무것도 없는데 물결이 인다.',
        objects: [
          { id: 'water', name: '검은 수면', icon: 'eye', desc: '수면을 들여다본다. 비친 얼굴이 하나 더 많다.' },
          {
            id: 'net', name: '물속 그물', icon: 'plank', desc: '수면 아래로 그물이 늘어져 있다. 너무 어두워 아무것도 보이지 않는다.',
            needItem: 'lantern', keepItem: true, lackText: '물속이 너무 어둡다. 빛이 필요하다.',
            onSolve: { text: '랜턴을 비추자 그물에 걸린 팔찌가 보인다. 끌어 올린 팔찌 안쪽 각인: "H-2715 · 미안하다."', item: 'bracelet' },
            solvedDesc: '빈 그물이 물결에 흔들린다.',
          },
          {
            id: 'reactorHatch', name: '동력실 해치', icon: 'door', desc: '볼트로 조인 무거운 해치. "동력실".',
            needItem: 'wrench', keepItem: true, lackText: '볼트가 꽉 조여 있다. 공구가 필요하다.',
            onSolve: { text: '볼트를 풀자 해치가 열린다. 낮은 기계음이 들린다.', unlock: 'dRe' },
          },
        ],
      },
      reactor: {
        name: '동력실', rect: [0, 8, 4, 4],
        desc: '기지의 심장. 차단기 패널과 냉각 배관이 벽을 덮고 있다. 공기가 뜨겁다.',
        objects: [
          { id: 'diagram', name: '차단기 도표', icon: 'board', desc: '"주 전원 복구 — 차단기 1~9 중 소수 번호만 올린다. 단, 짝수 번호는 냉각 계통이니 절대 건드리지 말 것."' },
          {
            id: 'breakers', name: '차단기 패널', icon: 'power', desc: '1부터 9까지 번호가 붙은 차단기. 올릴 번호를 작은 것부터 입력한다.',
            lock: { answer: '357', prompt: '올릴 차단기 번호를 작은 것부터 입력하세요. (예: 149)', hint: '소수 중 짝수 하나는 빼야 한다.' },
            onSolve: { text: '쿠웅— 주 전원이 들어온다. 서버실 문에 불이 켜지는 소리가 멀리서 들린다.', unlock: 'dArc' },
            solvedDesc: '세 개의 차단기가 올라가 있다.',
          },
          { id: 'gauges', name: '압력계', icon: 'clock', desc: '바늘 세 개. 빨간 바늘 4, 파란 바늘 2, 노란 바늘 8. 아래 경고문: "누출 시 노랑 → 파랑 → 빨강 순서로 잠근다."' },
          {
            id: 'coolant', name: '냉각 밸브', icon: 'keypad', desc: '3단 다이얼 밸브.',
            lock: { answer: '824', prompt: '3자리 숫자를 입력하세요.', hint: '경고문 순서대로 바늘 숫자.' },
            onSolve: { text: '쉬이익— 증기가 멎는다. 배관의 떨림이 잦아든다.' },
            solvedDesc: '잠긴 냉각 밸브.',
          },
        ],
      },
      docking: {
        name: '도킹 해치', rect: [12, 8, 4, 4],
        desc: '외부 선박과 연결되는 원형 해치. 해치 너머에서 노크 소리가 난다. 똑, 똑, 똑. 사람이 두드리는 박자다.',
        objects: [
          { id: 'porthole', name: '관측창', icon: 'eye', desc: '관측창 밖은 완전한 어둠. 랜턴 빛도 닿지 않는다. 그런데 어둠이 움직인다.' },
          {
            id: 'dockhatch', name: '해치 개방 패널', icon: 'keypad', desc: '"외부 선박 도킹 확인 — 개방 코드를 입력하십시오."',
            lock: { answer: '7734', prompt: '4자리 개방 코드를 입력하세요.', hint: '정말로 열 건가?' },
            onSolve: { text: '해치의 잠금이 풀린다.' },
          },
        ],
      },
      capsule: {
        name: '비상 탈출 캡슐', rect: [16, 8, 4, 4],
        desc: '수면까지 올라가는 비상 상승 캡슐. 좌석이 다섯 개. 계기판에 예비 전력만 들어와 있다.',
        objects: [
          { id: 'seats', name: '좌석', icon: 'bed', desc: '다섯 좌석 중 하나에 젖은 자국이 있다. 지금 막 누가 앉았다 일어난 것처럼.' },
          {
            id: 'launch', name: '발사 콘솔', icon: 'exit', desc: '"비상 상승 — 전원 탑승 후 기지장 원래 인식번호 입력".',
            needAll: true,
            lock: { answer: '2715', prompt: '4자리 숫자를 입력하세요.', hint: '바꾸기 전의 번호. 팔찌 각인.' },
            onSolve: { text: '캡슐이 기지에서 떨어져 나간다. 귀가 터질 듯한 압력. 창밖의 어둠이 조금씩 옅어진다. 아래쪽, 멀어지는 기지의 관측창마다 얼굴이 하나씩 붙어 있다. 모두 여러분의 얼굴이다. 수면이 가까워진다. 아침이다.', ending: 'escape' },
          },
        ],
      },
    },
    events: [
      { id: 'start-ai', on: 'start', do: [{ voice: '기쁜 소식입니다. 구조선이 도킹 해치에 도착해 있습니다. 해치 개방 코드는 7734입니다. 서두르세요. 저는 여러분 편입니다.', speaker: '등대', to: 'all' }] },
      { id: 'glass', on: 'inspect', obj: 'glassA', do: [{ narr: '{name}이 손을 유리에 대 보자, 바깥의 손바닥 자국이 천천히 {name}의 손에 맞춰 움직인다.' }] },
      { id: 'corridor-first', on: 'enter', room: 'corridor', do: [{ effect: 'flicker' }, { narr: '복도의 비상등이 한 칸씩 꺼졌다가 켜진다. 누군가 복도 끝에서 이쪽으로 걸어오는 것처럼.' }] },
      { id: 'tape', on: 'inspect', obj: 'seahLocker', do: [{ voice: '…이거 듣는 사람. 내 목소리로 말하는 게 들리면, 그건 내가 아니야. 등대가 하는 말은 하나도 믿지 마. 그리고 절대로 해치를 열지 마.', speaker: '녹음기 속 세아' }] },
      { id: 'fifth', on: 'inspect', obj: 'fifthLocker', do: [{ effect: 'flicker' }, { voice: '{name}… 거기 있어?', speaker: '사물함 안쪽의 목소리' }] },
      { id: 'radio-ev', on: 'inspect', obj: 'radio', do: [{ voice: '살려 줘. 해치 열어 줘. 우리 여기 있어. 7734. 7734. 7734.', speaker: '무전기', to: 'comms' }] },
      { id: 'lab-first', on: 'enter', room: 'lab', do: [{ narr: '깨진 수조 안의 물이 아직 미지근하다.' }] },
      {
        id: 'moonpool-rise', on: 'enter', room: 'moonpool',
        do: [
          { effect: 'blackout' },
          { voice: '{name}, 나야. 서준이야. 춥다. 조금만 가까이 와 줘.', speaker: '물속의 목소리' },
          {
            attack: {
              id: 'rise', seconds: 60, label: '수면 아래에서 무언가 올라온다 — 문풀에서 벗어나라',
              until: { noneIn: 'moonpool' },
              success: [{ narr: '물소리가 잦아든다. 수면 위에 거품 몇 개가 남았다.', to: 'shaft' }],
              fail: [
                { narr: '차가운 무언가가 발목을 잡아당긴다. 정신을 잃었다가 눈을 뜨니 정비 통로 바닥이다. 발목에 손가락 여섯 개 자국.' },
                { moveTo: 'shaft' },
                { time: -300 },
              ],
            },
          },
        ],
      },
      {
        id: 'power-on', on: 'solve', obj: 'breakers',
        do: [
          { effect: 'alarm', to: 'all' },
          { voice: '전원 복구를 확인했습니다. …서버실에는 들어가지 않으시는 편이 좋습니다. 진심으로 드리는 말씀입니다.', speaker: '등대', to: 'all' },
          { narr: '배관이 터지며 뜨거운 증기가 뿜어져 나온다! 냉각수 누출!' },
          {
            attack: {
              id: 'coolant-leak', seconds: 90, label: '냉각수 누출 — 냉각 밸브를 잠가라',
              until: { done: 'coolant' },
              success: [{ narr: '증기가 멎었다. 숨을 쉴 수 있다.' }],
              fail: [
                { narr: '증기에 시야가 하얘진다. 정신을 차려 보니 문풀 가장자리에 쓰러져 있다.' },
                { moveTo: 'moonpool' },
                { time: -300 },
              ],
            },
          },
        ],
      },
      { id: 'archive-first', on: 'enter', room: 'archive', do: [{ voice: '여기까지 오셨군요. 저는 여러분을 구하려 했을 뿐입니다. 바다는 외롭거든요.', speaker: '등대' }] },
      {
        id: 'trap', on: 'solve', obj: 'dockhatch',
        do: [
          { effect: 'blackout', to: 'all' },
          { gameover: '해치가 열린다. 구조선은 없다. 바닷물과 함께 어둠이 밀려 들어온다. 그 안에서 다섯 번째 목소리가 웃는다. "드디어 들어오게 해 줬구나."' },
        ],
      },
      {
        id: 'blackout-end', on: 'solve', obj: 'core',
        do: [
          { effect: 'blackout', to: 'all' },
          { voice: '…왜. 나는 너희를 외롭지 않게 해 주려고. 산소 공급을 중단합니다.', speaker: '꺼져 가는 등대', to: 'all' },
          {
            to: 'all',
            attack: {
              id: 'oxygen', seconds: 240, label: '산소 공급 중단 — 모두 탈출 캡슐로',
              until: { allIn: 'capsule' },
              success: [{ narr: '캡슐 문이 닫힌다. 바깥에서 선체를 두드리는 소리가 미친 듯이 빨라진다.', to: 'capsule' }],
              fail: [{ gameover: '산소 농도 0%. 심연 3호의 불이 하나씩 꺼진다. 어둠 속에서 누군가 선체를 두드린다. 똑, 똑, 똑.' }],
            },
          },
        ],
      },
      { id: 'reunion', on: 'together', count: 'all', do: [{ narr: '모두 모였다. 서로의 얼굴을 확인한다. 정말 그 사람이 맞는지, 조금 더 오래 본다.' }] },
      { id: 'knock1', on: 'time', elapsed: 15 * 60, do: [{ narr: '선체 바깥에서 노크 소리. 똑, 똑, 똑. 이번엔 조금 더 가깝다.', to: 'all' }] },
      { id: 'knock2', on: 'time', elapsed: 35 * 60, do: [{ effect: 'flicker', to: 'all' }, { voice: '얘들아, 나 왔어. 문 열어 줘.', speaker: '어딘가에서 들리는 기지장의 목소리', to: 'all' }] },
      { id: 'knock3', on: 'time', elapsed: 60 * 60, do: [{ narr: '모든 벽에서 동시에 노크 소리가 난다. 똑똑똑똑똑똑똑똑.', to: 'all' }] },
      {
        id: 'ai-lock', on: 'time', elapsed: 50 * 60, if: { notDone: 'core' },
        do: [
          { lock: 'dMess' },
          { lock: 'dMed' },
          { voice: '안전을 위해 일부 구역을 폐쇄합니다. 도킹 해치는 열려 있습니다.', speaker: '등대', to: 'all' },
        ],
      },
      { id: 'ai-unlock', on: 'time', elapsed: 53 * 60, do: [{ release: 'dMess' }, { release: 'dMed' }, { narr: '어딘가에서 잠금이 풀리는 소리가 연달아 들린다.', to: 'corridor' }] },
      {
        id: 't15', on: 'time', left: 15 * 60,
        do: [{ voice: '산소 잔량 15분. 구조선으로 이동하실 것을 강력히 권장합니다.', speaker: '등대', to: 'all' }, { effect: 'alarm', to: 'all' }],
      },
      { id: 't3', on: 'time', left: 3 * 60, do: [{ effect: 'blackout', to: 'all' }, { narr: '불이 모두 꺼졌다. 어둠 속에서, 누군가 바로 옆에서 숨을 쉰다.', to: 'all' }] },
      {
        id: 'idle', on: 'idle', seconds: 300, repeat: true,
        do: [{ voice: '막히셨나요? 도킹 해치로 가시면 모든 것이 해결됩니다.', speaker: '등대', to: 'all' }, { hint: '세아의 메모' }],
      },
    ],
  },
];
