#define KP_HOST_TEST
#include "../esp32-kolampintar.ino"
#include <iostream>
#include <string>

// Host-side test adapter around the SAME sequence used by the ESP32 sketch.
int main() {
  DemoSequence demo;
  std::string action;
  uint32_t now;
  while (std::cin >> action >> now) {
    bool applied = true;
    if (action != "TICK") applied = demo.command(action.c_str(), now);
    demo.tick(now);
    std::cout << "{\"applied\":" << (applied ? "true" : "false")
              << ",\"demoStep\":\"" << demo.name()
              << "\",\"demoPaused\":" << (demo.paused ? "true" : "false")
              << ",\"demoRevision\":" << demo.revision
              << ",\"ph\":" << demo.ph
              << ",\"solenoid\":\"" << (demo.valve ? "ON" : "OFF") << "\"}" << std::endl;
  }
}
