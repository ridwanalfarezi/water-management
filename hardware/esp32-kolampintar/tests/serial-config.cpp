#define KP_HOST_TEST
#include "../esp32-kolampintar.ino"
#include <assert.h>
#include <string>

int main() {
  using C = SerialCommand;
  assert(C::parse("wifi ssid Booth Network").kind == C::WIFI_SSID);
  assert(!strcmp(C::parse("WIFI SSID Booth Network").value, "Booth Network"));
  assert(C::parse("WIFI SSID ").kind == C::INVALID);
  assert(C::parse((std::string("WIFI SSID ") + std::string(33, 'a')).c_str()).kind == C::INVALID);
  auto password = C::parse("WiFi PaSs CaseSensitive  ");
  assert(password.kind == C::WIFI_PASS && !strcmp(password.value, "CaseSensitive  "));
  assert(C::parse("WIFI PASS ").kind == C::WIFI_PASS);
  assert(C::parse("WIFI PASS short").kind == C::INVALID);
  assert(C::parse((std::string("WIFI PASS ") + std::string(64, 'a')).c_str()).kind == C::WIFI_PASS);
  assert(C::parse((std::string("WIFI PASS ") + std::string(64, 'z')).c_str()).kind == C::INVALID);
  assert(C::parse("MQTT HOST 192.168.1.10").kind == C::MQTT_HOST);
  assert(C::parse("MQTT HOST broker.local").kind == C::MQTT_HOST);
  assert(C::parse("MQTT HOST ").kind == C::INVALID);
  assert(C::parse("MQTT HOST mqtt://broker").kind == C::INVALID);
  assert(C::parse("MQTT HOST bad host").kind == C::INVALID);
  assert(C::parse("MQTT PORT 1883").port == 1883);
  assert(C::parse("MQTT PORT 65535").port == 65535);
  for (const char* bad : {"", "0", "65536", "-1", "1883junk", "99999999999999999999"})
    assert(C::parse((std::string("MQTT PORT ") + bad).c_str()).kind == C::INVALID);
  assert(C::parse("WIFI CONNECT").kind == C::WIFI_CONNECT);
  assert(C::parse("MQTT CONNECT").kind == C::MQTT_CONNECT);
  assert(C::parse("STATUS").kind == C::STATUS);
  assert(C::parse("HELP").kind == C::HELP);
  assert(C::parse("ON").kind == C::INVALID);
  assert(C::parse("OFF").kind == C::INVALID);
}
