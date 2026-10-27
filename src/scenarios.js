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
// timeLimit 은 방장이 대기실에서 "제한 시간"을 켰을 때만 쓰인다. 기본은 제한 시간 없음.
//   문구 안의 {name} 은 조건을 일으킨 캐릭터 이름, {room} 은 그 구역 이름으로 바뀐다.
export const SCENARIOS = [
  {
    id: 'bunker',
    title: '제1화 · 지하 연구소',
    summary: '멤버들은 서로 다른 감금실에서 눈을 뜬다. 흩어진 동료와 목소리로 협력해 지상으로 탈출하라.',
    timeLimit: 30 * 60,
    failText: '시간 초과. 시설이 완전히 봉쇄되었다…',
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
];
