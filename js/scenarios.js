// 에피소드 데이터. 새 에피소드는 같은 형식으로 SCENARIOS 배열에 추가하면 된다.
//
// 오브젝트 필드
//   desc        조사했을 때 나오는 설명
//   bonus       '관찰력' 특기 멤버가 조사하면 추가로 보이는 단서
//   showIf      이 오브젝트 id가 해결된 뒤에만 보임
//   needItem    필요한 아이템 id (없으면 lackText 출력)
//   needSolved  먼저 해결돼야 하는 오브젝트 id (없으면 lackText 출력)
//   lock        { answer, prompt, hint, forceable }  — 정답 입력 퍼즐
//   onSolve     { text, item, goto, ending }  — 해결 시 결과
//   solvedDesc  해결 후 다시 조사했을 때 설명
//   goto        (해결 없이) 바로 이동하는 출구
const SCENARIOS = [
  {
    id: 'bunker',
    title: '제1화 · 지하 연구소',
    summary: '눈을 떠 보니 낯선 지하 시설. 30분 안에 지상으로 탈출하라.',
    timeLimit: 30 * 60,
    start: 'cell',
    intro: [
      '삐— 삐— 삐—',
      '희미한 경보음과 함께 멤버들이 하나둘 눈을 뜬다.',
      '차가운 콘크리트 바닥, 깜빡이는 형광등. 이곳이 어디인지 아무도 기억하지 못한다.',
      '벽면 스피커에서 지직거리는 목소리가 흘러나온다.',
      '"…30분 뒤, 이 시설은 완전히 봉쇄된다. 그 전에 나가라."',
    ],
    items: {
      flashlight: { name: '손전등', icon: '🔦' },
      keycard: { name: '카드키', icon: '💳' },
      fuse: { name: '예비 퓨즈', icon: '🔌' },
    },
    hints: [
      { until: 'locker', text: '감금실의 무언가가 멈춰 있다. 그 숫자를 자물쇠에.' },
      { until: 'corner', text: '손전등으로 비춰 볼 만한 곳이 있다.' },
      { until: 'door', text: '카드키는 문에 쓰는 물건이다.' },
      { until: 'cabinet', text: '화이트보드의 동그라미 친 글자를 순서대로.' },
      { until: 'panel', text: '박사의 일지와 액자를 같이 보자. 날짜를 4자리 숫자로.' },
      { until: 'elevator', text: '전원이 들어왔다면 엘리베이터로.' },
      { until: 'keypad', text: '0317 + 1124 = ?' },
    ],
    rooms: {
      cell: {
        name: '감금실',
        desc: '사방이 콘크리트인 작은 방. 형광등이 깜빡이고, 철문은 굳게 잠겨 있다.',
        objects: [
          {
            id: 'bed', name: '낡은 철제 침대', icon: '🛏️',
            desc: '삐걱거리는 침대. 매트리스 아래에 구겨진 쪽지가 끼워져 있다. "시간은 멈춰도 답은 남는다."',
            bonus: '쪽지 뒷면에 아주 작게 "시 → 분, 4자리"라고 적혀 있다.',
          },
          {
            id: 'clock', name: '멈춘 벽시계', icon: '🕰️',
            desc: '시계가 3시 17분에서 멈춰 있다. 초침만 미세하게 떨린다.',
            bonus: '시계 유리에 누군가 손톱으로 "기억해"라고 긁어 놓았다.',
          },
          {
            id: 'locker', name: '자물쇠 걸린 사물함', icon: '🔒',
            desc: '4자리 숫자 자물쇠가 걸린 철제 사물함.',
            lock: { answer: '0317', prompt: '4자리 숫자를 입력하세요.', hint: '이 방에서 "멈춘" 것은?', forceable: true },
            onSolve: { text: '철컥! 사물함 안에서 손전등을 찾았다.', item: 'flashlight' },
            solvedDesc: '열린 사물함. 이제 텅 비어 있다.',
          },
          {
            id: 'corner', name: '어두운 구석', icon: '🌑',
            desc: '빛이 닿지 않는 방구석.',
            needItem: 'flashlight', lackText: '너무 어두워서 아무것도 보이지 않는다. 빛이 필요하다.',
            onSolve: { text: '손전등으로 비추자 바닥 틈에 끼인 카드키가 반짝인다!', item: 'keycard' },
            solvedDesc: '먼지 쌓인 구석. 더는 아무것도 없다.',
          },
          {
            id: 'door', name: '철문', icon: '🚪',
            desc: '카드 리더기가 달린 무거운 철문.',
            needItem: 'keycard', lackText: '카드 리더기가 붉게 빛난다. 카드키가 필요하다.',
            onSolve: { text: '삑— 초록불과 함께 철문이 열린다!', goto: 'lab' },
            solvedDesc: '열린 철문. 연구실로 이어진다.', goto: 'lab',
          },
        ],
      },
      lab: {
        name: '연구실',
        desc: '서류가 어지럽게 흩어진 연구실. 벽에는 비상 전원 패널이, 안쪽에는 불 꺼진 엘리베이터가 보인다.',
        objects: [
          { id: 'toCell', name: '감금실로 돌아가기', icon: '↩️', desc: '', goto: 'cell' },
          {
            id: 'journal', name: '연구 일지', icon: '📓',
            desc: '"비상 전원 암호는 우리 딸 생일로 해 두었다. 이번엔 잊지 말자." — 박사 K',
            bonus: '일지 마지막 장이 찢겨 있다. 누군가 서둘러 떠난 것 같다.',
          },
          {
            id: 'photo', name: '책상 위 액자', icon: '🖼️',
            desc: '환하게 웃는 박사와 어린 소녀의 사진. 액자를 뒤집자 "지수 첫 생일 — 11월 24일"이라는 글씨가 보인다.',
          },
          {
            id: 'board', name: '화이트보드', icon: '📋',
            desc: '알 수 없는 수식 사이사이, 빨간 동그라미가 쳐진 글자 넷: E · X · I · T. 화살표가 캐비닛을 가리킨다.',
          },
          {
            id: 'cabinet', name: '철제 캐비닛', icon: '🗄️',
            desc: '알파벳 4글자 다이얼 자물쇠가 달려 있다.',
            lock: { answer: 'EXIT', prompt: '알파벳 4글자를 입력하세요.', hint: '화이트보드를 보자.', forceable: true },
            onSolve: { text: '캐비닛 안에서 예비 퓨즈를 찾았다!', item: 'fuse' },
            solvedDesc: '열린 캐비닛. 서류 뭉치뿐이다.',
          },
          {
            id: 'panel', name: '비상 전원 패널', icon: '⚡',
            desc: '퓨즈 소켓 하나가 비어 있고, 옆에 숫자 키패드가 달려 있다.',
            needItem: 'fuse', lackText: '퓨즈 소켓이 비어 있다. 이대로는 작동하지 않는다.',
            lock: { answer: '1124', prompt: '퓨즈를 꽂자 화면이 켜졌다. 비상 전원 암호(4자리)를 입력하세요.', hint: '박사가 잊지 않으려 한 날짜.' },
            onSolve: { text: '윙— 비상 전원이 들어온다! 엘리베이터에 불이 켜졌다.' },
            solvedDesc: '전원 패널이 초록색으로 빛나고 있다.',
          },
          {
            id: 'elevator', name: '엘리베이터', icon: '🛗',
            desc: '낡은 화물용 엘리베이터.',
            needSolved: 'panel', lackText: '전원이 꺼져 있어 꿈쩍도 하지 않는다.',
            onSolve: { text: '띵— 엘리베이터 문이 열린다.', goto: 'lift' },
            solvedDesc: '엘리베이터 문이 열려 있다.', goto: 'lift',
          },
        ],
      },
      lift: {
        name: '엘리베이터 안',
        desc: '좁은 엘리베이터. 층 버튼 대신 숫자 키패드만 있고, 화면에 "최종 인증 코드 입력"이 깜빡인다.',
        objects: [
          { id: 'toLab', name: '연구실로 나가기', icon: '↩️', desc: '', goto: 'lab' },
          {
            id: 'warning', name: '벽에 붙은 경고문', icon: '📝',
            desc: '"최종 코드 = 처음 깨어난 곳의 시간 + 잊지 말아야 할 날"',
            bonus: '누군가 연필로 "더하기!!"라고 밑줄을 쳐 두었다.',
          },
          {
            id: 'keypad', name: '최종 키패드', icon: '🔢',
            desc: '이 코드만 맞히면 지상이다.',
            lock: { answer: '1441', prompt: '최종 인증 코드(4자리)를 입력하세요.', hint: '감금실 시계 + 딸의 생일.' },
            onSolve: { text: '인증 완료. 엘리베이터가 덜컹이며 위로 올라간다…', ending: 'escape' },
          },
        ],
      },
    },
  },
];
