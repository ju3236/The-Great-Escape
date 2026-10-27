// 실제 에피소드 데이터가 서로 맞물리는지만 확인한다 (내용은 출력하지 않는다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SCENARIOS } from '../src/scenarios.js';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${readFileSync(new URL('../public/js/pixels.js', import.meta.url), 'utf8')};this.ICONS = PIXEL_ICONS;`, ctx);

for (const sc of SCENARIOS) {
  test(`에피소드 데이터가 서로 맞물린다: ${sc.id}`, () => {
    const objects = Object.values(sc.rooms).flatMap((r) => r.objects);
    const objIds = new Set();
    for (const o of objects) {
      assert.ok(!objIds.has(o.id), `오브젝트 id 중복: ${o.id}`);
      objIds.add(o.id);
    }
    const linkIds = new Set(sc.links.map((l) => l.id));
    const known = (id) => objIds.has(id) || linkIds.has(id);

    for (const st of sc.starts) assert.ok(sc.rooms[st], `시작 구역 없음: ${st}`);
    for (const l of sc.links) assert.ok(sc.rooms[l.a] && sc.rooms[l.b], `링크 끝 구역 없음: ${l.id}`);
    for (const o of objects) {
      assert.ok(ctx.ICONS[o.icon], `아이콘 없음: ${o.icon}`);
      if (o.needItem) assert.ok(sc.items[o.needItem], `필요 아이템 없음: ${o.id}`);
      if (o.onSolve?.item) assert.ok(sc.items[o.onSolve.item], `주는 아이템 없음: ${o.id}`);
      if (o.onSolve?.unlock) assert.ok(linkIds.has(o.onSolve.unlock), `여는 링크 없음: ${o.id}`);
      if (o.lock) assert.ok(String(o.lock.answer).length > 0, `정답 비어 있음: ${o.id}`);
    }
    for (const it of Object.values(sc.items)) assert.ok(ctx.ICONS[it.icon], `아이템 아이콘 없음: ${it.icon}`);
    for (const h of sc.hints) assert.ok(known(h.until), `힌트 대상 없음: ${h.until}`);
    assert.ok(objects.some((o) => o.onSolve?.ending), '탈출 지점이 있어야 한다');

    for (const ev of sc.events || []) {
      if (ev.obj) assert.ok(objIds.has(ev.obj), `이벤트 오브젝트 없음: ${ev.id}`);
      if (ev.room) assert.ok(sc.rooms[ev.room], `이벤트 구역 없음: ${ev.id}`);
      for (const act of ev.do) {
        for (const k of ['unlock', 'lock', 'release']) if (act[k]) assert.ok(linkIds.has(act[k]), `이벤트 링크 없음: ${ev.id}`);
        if (act.to && !['all', 'here'].includes(act.to)) assert.ok(sc.rooms[act.to], `이벤트 대상 구역 없음: ${ev.id}`);
        if (act.effect) assert.ok(['flicker', 'blackout', 'alarm'].includes(act.effect), `알 수 없는 효과: ${ev.id}`);
        if (act.attack) {
          const u = act.attack.until || {};
          assert.ok(act.attack.id && act.attack.seconds > 0, `타임어택 설정 빠짐: ${ev.id}`);
          if (u.done) assert.ok(known(u.done), `타임어택 조건 대상 없음: ${ev.id}`);
          for (const k of ['allIn', 'noneIn']) if (u[k]) assert.ok(sc.rooms[u[k]], `타임어택 조건 구역 없음: ${ev.id}`);
          for (const f of act.attack.fail || []) if (f.moveTo) assert.ok(sc.rooms[f.moveTo], `끌려갈 구역 없음: ${ev.id}`);
        }
      }
    }
  });
}
