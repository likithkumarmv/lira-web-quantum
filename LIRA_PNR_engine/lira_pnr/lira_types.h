#pragma once
#include <Arduino.h>

struct Tag { String ref, role, entity; };
struct Branch { String id, kind, trigTag, truck, resource, glyph; uint32_t windowStart = 0, preApproved = 0; };
struct Row { int seq; String truck, cont, chassis, status; uint32_t win = 0; };
struct Glyph { String id; uint16_t w = 0, h = 0; uint8_t* buf = nullptr; };
