#pragma once
#include <stdint.h>
#include <string.h>
#include <math.h>

// Expo-only sequence. No sensor input or chemical dosing control.
struct DemoSequence {
  enum Step { NORMAL, FOOD, DANGER, ACTIVE, RECOVERY, RESTORED, READY, STOPPED };
  Step step = NORMAL;
  bool paused = false;
  bool valve = false;
  float ph = 7.5f;
  uint32_t revision = 0;
  uint32_t enteredAt = 0;
  uint32_t pausedAt = 0;
  uint32_t sampledAt = 0;
  uint32_t randomState = 0x6d2b79f5;
  float drift = 0, noise = 0, ambient = 0, trend = 7.5f, startPH = 7.5f;
  static constexpr uint32_t VALVE_MS = 3000;
  static constexpr uint32_t RECOVERY_MS = 4000;

  const char* name() const {
    const char* names[] = {"NORMAL", "FOOD", "DANGER", "ACTIVE", "RECOVERY", "RESTORED", "READY", "STOPPED"};
    return names[step];
  }

  void enter(Step next, uint32_t now) {
    startPH = trend;
    step = next;
    enteredAt = now;
    valve = next == ACTIVE;
    if (next == NORMAL || next == STOPPED) {
      trend = startPH = ph = 7.5f;
      drift = noise = ambient = 0;
      sampledAt = now;
    }
    ++revision;
  }

  bool command(const char* action, uint32_t now) {
    if (!strcmp(action, "RESET") || !strcmp(action, "STOP")) {
      paused = false;
      enter(!strcmp(action, "RESET") ? NORMAL : STOPPED, now);
      return true;
    }
    if (!strcmp(action, "START")) {
      if (step != NORMAL && step != READY && step != STOPPED) return false;
      paused = false;
      enter(FOOD, now);
      return true;
    }
    if (!strcmp(action, "PAUSE")) {
      if (paused || step == STOPPED || step == READY) return false;
      // Never leave an open valve while the crew pauses the story.
      if (step == ACTIVE) enter(RECOVERY, now);
      valve = false;
      paused = true;
      pausedAt = now;
      ++revision;
      return true;
    }
    if (!strcmp(action, "RESUME")) {
      if (!paused) return false;
      enteredAt += now - pausedAt;
      sampledAt += now - pausedAt;
      paused = false;
      ++revision;
      return true;
    }
    if (strcmp(action, "NEXT") || paused) return false;
    switch (step) {
      case NORMAL: enter(FOOD, now); break;
      case FOOD: enter(DANGER, now); break;
      case DANGER: enter(ACTIVE, now); break;
      case ACTIVE: enter(RECOVERY, now); break;
      case RECOVERY: return false; // Recovery completes on the device timer.
      case RESTORED: enter(READY, now); break;
      default: return false;
    }
    return true;
  }

  void tick(uint32_t now) {
    if (paused) return;
    // Correlated drift plus much smaller measurement noise, at a fixed cadence.
    // Unlike a sine wave, samples do not repeat a visible periodic pattern.
    uint32_t samples = uint32_t(now - sampledAt) / 500;
    if (samples > 120) { samples = 120; sampledAt = now - samples * 500; }
    while (samples--) {
      sampledAt += 500;
      if (step == NORMAL || step == RESTORED || step == READY) {
        // Slow, irregular baseline movement inside the expo's normal envelope.
        ambient = ambient * 0.997f + randomUnit() * 0.008f;
        ambient = fmaxf(-0.24f, fminf(0.24f, ambient));
      }
      drift = drift * 0.94f + randomUnit() * 0.012f;
      drift = fmaxf(-0.045f, fminf(0.045f, drift));
      noise = randomUnit() * 0.006f;
    }
    const uint32_t elapsed = now - enteredAt;
    if (step == FOOD) trend = interpolate(startPH, 7.0f, elapsed, 6000);
    else if (step == DANGER) trend = interpolate(startPH, 6.0f, elapsed, 4000);
    else if (step == ACTIVE) trend = interpolate(startPH, 6.0f, elapsed, VALVE_MS);
    else if (step == RECOVERY) trend = interpolate(startPH, 7.5f + ambient, elapsed, RECOVERY_MS);
    else trend = 7.5f + ambient;
    if (step == ACTIVE && uint32_t(now - enteredAt) >= VALVE_MS) enter(RECOVERY, now);
    if (step == RECOVERY && uint32_t(now - enteredAt) >= RECOVERY_MS) enter(RESTORED, now);
    ph = trend + drift + noise;
  }

  float randomUnit() {
    randomState ^= randomState << 13;
    randomState ^= randomState >> 17;
    randomState ^= randomState << 5;
    return float(randomState & 0xffff) / 32767.5f - 1.0f;
  }

  static float interpolate(float from, float to, uint32_t elapsed, uint32_t duration) {
    const float t = fminf(1.0f, float(elapsed) / duration);
    return from + (to - from) * t * t * (3.0f - 2.0f * t);
  }
};
