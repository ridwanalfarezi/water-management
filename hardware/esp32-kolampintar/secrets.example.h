#pragma once

// Copy this file to secrets.h, then fill in your local values.
// Do not commit secrets.h.
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// LAN IP of the computer running docker compose (never use localhost here).
const char* MQTT_HOST = "192.168.1.100";
const uint16_t MQTT_PORT = 1883;
