#include "../demo-sequence.h"
#include <assert.h>
#include <initializer_list>

int main() {
  DemoSequence live;
  float previous = live.ph, minimum = 7.5f, maximum = 7.5f;
  DemoSequence fast;
  for (uint32_t now = 0; now < 60000; now += 500) {
    live.tick(now);
    for (uint32_t t = now; t < now + 500; ++t) fast.tick(t);
    assert(fabsf(fast.ph - live.ph) < 0.0001f);
    assert(live.ph >= 7.2f && live.ph <= 7.8f && !live.valve);
    assert(fabsf(live.ph - previous) < 0.045f);
    minimum = fminf(minimum, live.ph); maximum = fmaxf(maximum, live.ph);
    previous = live.ph;
    assert(live.revision == 0);
  }
  assert(maximum - minimum > 0.05f);
  for (uint32_t seed = 1; seed <= 8; ++seed) {
    DemoSequence normal;
    normal.randomState = seed;
    float last = normal.ph;
    for (uint32_t now = 0; now < 600000; now += 500) {
      normal.tick(now);
      assert(normal.ph >= 7.2f && normal.ph <= 7.8f && !normal.valve);
      assert(fabsf(normal.ph - last) < 0.045f);
      last = normal.ph;
    }
  }
  live.command("PAUSE", 60000);
  const float frozen = live.ph;
  live.tick(65000); assert(live.ph == frozen);
  live.command("RESET", 66000);
  live.command("START", 66001);
  live.tick(72001); assert(live.ph >= 6.949f && live.ph <= 7.051f);
  live.command("NEXT", 73000);
  const float beforeDrop = live.ph;
  live.tick(73000); assert(fabsf(live.ph - beforeDrop) < 0.035f);
  for (uint32_t now = 73000; now < 90000; now += 500) {
    live.tick(now); assert(live.ph >= 5.949f && live.ph <= 7.051f && !live.valve);
    if (now >= 77000) assert(live.ph <= 6.051f);
  }
  for (int round = 0; round < 10; ++round) {
    DemoSequence d;
    assert(!d.valve && d.ph == 7.5f && d.step == DemoSequence::NORMAL);
    assert(!d.command("ON", 0));
    assert(d.command("START", 100));
    assert(d.command("NEXT", 200));
    assert(d.ph == 7.5f && !d.valve); // Commands do not teleport the reading.
    assert(d.command("NEXT", 300));
    assert(d.valve);
    d.tick(3299); assert(d.valve);
    d.tick(3300); assert(!d.valve && d.step == DemoSequence::RECOVERY);
    d.tick(5300); assert(d.ph >= 6.699f && d.ph <= 6.801f);
    d.tick(7300); assert(d.ph >= 7.449f && d.ph <= 7.551f && d.step == DemoSequence::RESTORED);
    assert(d.command("NEXT", 7400)); assert(d.step == DemoSequence::READY);
    assert(d.command("RESET", 7500)); assert(d.step == DemoSequence::NORMAL && !d.valve);
  }
  for (const char* action : {"RESET", "STOP", "PAUSE"}) {
    DemoSequence d;
    d.command("START", 0); d.command("NEXT", 1); d.command("NEXT", 2);
    assert(d.valve);
    assert(d.command(action, 3)); assert(!d.valve);
    d.tick(10000); assert(!d.valve);
    if (d.paused) {
      assert(!d.command("NEXT", 10001));
      assert(d.command("RESUME", 10002));
      d.tick(14002); assert(d.step == DemoSequence::RESTORED && !d.valve);
    }
  }
  DemoSequence wrap;
  wrap.command("START", 0xfffffff0); wrap.command("NEXT", 0xfffffff1);
  wrap.command("NEXT", 0xfffffff2);
  wrap.tick(uint32_t(0xfffffff2 + 3000ULL)); assert(!wrap.valve);
}
