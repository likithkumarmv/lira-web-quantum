/*
  LIRA-Q SENTINEL · BAY STATION · FIRMWARE v13
  ESP32 DevKit V1 + ILI9341 2.8" (display only) + RC522 (shared SPI)
  No buttons. No touch. Interaction = card taps. Authorization = web custodian.

  Libraries (Library Manager): Adafruit ILI9341, Adafruit GFX, MFRC522, ArduinoJson (v7)
  Board: "DOIT ESP32 DEVKIT V1"

  Serial commands (115200, newline):
    wifi <ssid> <password>     save Wi-Fi
    server http://IP:8000      save backend base (no trailing slash, no /api/v1)
    key <device_secret>        save HMAC key (same string as backend EDGE_HMAC_KEY_EDGE_01)
    show                       print config + status
    sim <UID>                  simulate a tap without a card (e.g. sim 04A1B2C3)
    clearq                     clear offline observation queue
    reboot
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSansBold9pt7b.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include <Fonts/FreeSansBold18pt7b.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include "mbedtls/md.h"
#include "lira_types.h"   // structs live here so Arduino auto-prototypes compile

// explicit prototypes (default arguments must appear only here)
int signedRequest(const char* method, const String& path, const String& body, String& resp,
                  const char** hdrKeys = nullptr, size_t nHdr = 0, HTTPClient* keep = nullptr);
void screen(const char* title, uint16_t titleCol, uint16_t bg, const String& l1, const String& l2, const String& l3,
            const String& glyphId = "");

// ---------------- pins (verified in gates H2-H4) ----------------
#define TFT_CS    14
#define TFT_DC    22
#define TFT_RST    4
#define RC522_SS  21
#define RC522_RST 27

// ===================== LAB DEFAULTS (edit DEFAULT_SERVER only) =====================
#define DEFAULT_SSID    "LIRA-LAB"                    // demo hotspot (Windows Mobile Hotspot on the web laptop, 2.4 GHz)
#define DEFAULT_PASS    "LIRA2026lab"
#define DEFAULT_SERVER  "http://192.168.137.1:8000"   // web laptop = hotspot host. Override anytime: Serial "server http://IP:PORT"
#define DEFAULT_KEY     "lira-lab-device-key-change-me-32b"
// Serial commands still override these and are remembered across reboots.
// ====================================================================================

#define FW_VERSION      "v13.0"
#define DEVICE_ID       "EDGE-01"
#define STEP2_TIMEOUT_S 30
#define CUSTODIAN_WAIT_S 120
#define MAX_QUEUE       6
#define MAX_TAGS        16
#define MAX_BRANCHES    4
#define MAX_ROWS        3
#define MAX_GLYPHS      4

// ---------------- colours (LIRA tokens, RGB565) ----------------
#define C_BG      0x08A4   // #0B1420
#define C_SURF    0x10E5   // #111F2E
#define C_INK     0xEF9F   // #EAF3F8
#define C_MUTED   0x9DB8   // #9FB5C5
#define C_CYAN    0x3E5B   // #39C9DF
#define C_OK      0x3E93   // #38D39F
#define C_WARN    0xFDCA   // #FFB951
#define C_ERR     0xFDB5   // #FFB4AB
#define C_ERRBG   0x30A2   // #321415

Adafruit_ILI9341 tft(TFT_CS, TFT_DC, TFT_RST);
MFRC522 rfid(RC522_SS, RC522_RST);
Preferences prefs;

// ---------------- config ----------------
String cfgSsid, cfgPass, cfgServer, cfgKey;

// ---------------- time ----------------
int64_t serverOffset = 0;      // server_unix - millis/1000
uint32_t lastTimeSyncMs = 0;
bool timeSynced = false;
uint32_t nowUnix() { return (uint32_t)(serverOffset + (int64_t)(millis() / 1000)); }
bool clockFresh() { return timeSynced && (millis() - lastTimeSyncMs) < 600000UL; }

// ---------------- state from server ----------------

struct {
  bool valid = false;
  uint32_t fetchedMs = 0;
  String version, planVersion, expectedTag, workOrder, resource, snapshot, runId, validator;
  uint32_t expires = 0;
  Tag tags[MAX_TAGS]; int nTags = 0;
  Branch br[MAX_BRANCHES]; int nBr = 0;
} cap;

struct {
  bool fresh = false;
  uint32_t fetchedMs = 0;
  String siteId = "JNPT-BAY-04", siteRole = "STAGING_BAY", planVersion, resourceState;
  bool reoptRequired = false, mayRequest = false; String reoptRequestId; String lastReoptSent;
  String ixSession, ixState, ixCode, ixTxn, ixEir;
} st;

struct {
  bool valid = false;
  String planVersion, runId, validator, shadow, glyphId;
  Row rows[MAX_ROWS]; int n = 0;
  String cliffCont, cliffKind; uint32_t cliffAt = 0;
} board;

Glyph glyphs[MAX_GLYPHS];

// ---------------- interchange session (local) ----------------
struct {
  bool open = false;
  String id, truckTag, truckId, expectEquipTag, expectResource, branchId;
  uint32_t openedMs = 0;
} sess;
uint32_t sessCounter = 0, seqCounter = 0;

// ---------------- UI mode ----------------
enum Mode { M_BOARD, M_TAP1, M_RESULT, M_WAIT_CUSTODIAN, M_COMMITTED };
Mode mode = M_BOARD;
uint32_t modeUntilMs = 0, waitStartMs = 0;
String lastUid; uint32_t lastUidMs = 0;
bool netOk = false;

// timers
uint32_t tState = 0, tCap = 0, tBoard = 0, tHealth = 0, tQueue = 0, tWifi = 0, tDraw = 0;

// ======================= crypto =======================
String toHex(const uint8_t* b, size_t n) {
  static const char* h = "0123456789abcdef"; String s; s.reserve(n * 2);
  for (size_t i = 0; i < n; i++) { s += h[b[i] >> 4]; s += h[b[i] & 15]; }
  return s;
}
String sha256Hex(const String& in) {
  uint8_t out[32];
  mbedtls_md_context_t ctx; mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 0);
  mbedtls_md_starts(&ctx); mbedtls_md_update(&ctx, (const uint8_t*)in.c_str(), in.length());
  mbedtls_md_finish(&ctx, out); mbedtls_md_free(&ctx);
  return toHex(out, 32);
}
String hmacHex(const String& key, const String& msg) {
  uint8_t out[32];
  mbedtls_md_context_t ctx; mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const uint8_t*)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const uint8_t*)msg.c_str(), msg.length());
  mbedtls_md_hmac_finish(&ctx, out); mbedtls_md_free(&ctx);
  return toHex(out, 32);
}
bool constEq(const String& a, const String& b) {
  if (a.length() != b.length()) return false;
  uint8_t d = 0; for (size_t i = 0; i < a.length(); i++) d |= a[i] ^ b[i];
  return d == 0;
}
String newNonce() {
  char b[33]; snprintf(b, sizeof(b), "%08lx%08lx%08lx%08lx",
    (unsigned long)esp_random(), (unsigned long)esp_random(), (unsigned long)millis(), (unsigned long)esp_random());
  return String(b);
}

// ======================= HTTP (signed) =======================
// signature = HMAC(key, METHOD\nPATH\nNONCE\nSHA256_HEX(body))
int signedRequest(const char* method, const String& path, const String& body, String& resp,
                  const char** hdrKeys, size_t nHdr, HTTPClient* keep) {
  if (WiFi.status() != WL_CONNECTED || cfgServer.isEmpty() || cfgKey.isEmpty()) return -100;
  String nonce = newNonce();
  String sig = hmacHex(cfgKey, String(method) + "\n" + path + "\n" + nonce + "\n" + sha256Hex(body));
  HTTPClient local; HTTPClient& http = keep ? *keep : local;
  http.setTimeout(4000);
  if (!http.begin(cfgServer + path)) return -101;
  http.addHeader("X-LIRA-Device", DEVICE_ID);
  http.addHeader("X-LIRA-Nonce", nonce);
  http.addHeader("X-LIRA-Signature", sig);
  if (hdrKeys) http.collectHeaders(hdrKeys, nHdr);
  int code;
  if (strcmp(method, "POST") == 0) { http.addHeader("Content-Type", "application/json"); code = http.POST(body); }
  else code = http.GET();
  if (code > 0 && !keep) resp = http.getString();
  if (!keep) http.end();
  return code;
}

// ======================= config =======================
void loadConfig() {
  prefs.begin("lira", true);
  cfgSsid = prefs.getString("ssid", ""); cfgPass = prefs.getString("pass", "");
  cfgServer = prefs.getString("server", ""); cfgKey = prefs.getString("key", "");
  seqCounter = prefs.getUInt("seq", 0); sessCounter = prefs.getUInt("sess", 0);
  prefs.end();
  cfgSsid = DEFAULT_SSID; cfgPass = DEFAULT_PASS;          // always use the built-in hotspot
  if (cfgServer.isEmpty()) cfgServer = DEFAULT_SERVER;
  if (cfgKey.isEmpty())    cfgKey = DEFAULT_KEY;
}
void saveStr(const char* k, const String& v) { prefs.begin("lira", false); prefs.putString(k, v); prefs.end(); }
void saveCounters() { prefs.begin("lira", false); prefs.putUInt("seq", seqCounter); prefs.putUInt("sess", sessCounter); prefs.end(); }

// ======================= offline queue (NVS, observations only) =======================
int queueCount() { prefs.begin("liraq", true); int n = prefs.getInt("n", 0); prefs.end(); return n; }
bool queuePush(const String& json) {
  prefs.begin("liraq", false);
  int n = prefs.getInt("n", 0);
  if (n >= MAX_QUEUE) { prefs.end(); return false; }
  prefs.putString(("q" + String(n)).c_str(), json); prefs.putInt("n", n + 1);
  prefs.end(); return true;
}
void queueClear() { prefs.begin("liraq", false); prefs.clear(); prefs.end(); }
void queueFlush() {
  int n = queueCount(); if (n == 0 || !netOk) return;
  prefs.begin("liraq", true);
  String items[MAX_QUEUE]; for (int i = 0; i < n; i++) items[i] = prefs.getString(("q" + String(i)).c_str(), "");
  prefs.end();
  int sent = 0;
  for (int i = 0; i < n; i++) {
    String r; int code = signedRequest("POST", "/api/v1/edge/events", items[i], r);
    if (code == 200 || code == 201 || code == 202 || code == 409) sent++; else break;  // keep order
  }
  // rewrite remaining
  prefs.begin("liraq", false); prefs.clear();
  for (int i = sent; i < n; i++) prefs.putString(("q" + String(i - sent)).c_str(), items[i]);
  prefs.putInt("n", n - sent); prefs.end();
  if (sent) Serial.printf("[Q] replayed %d queued observation(s)\n", sent);
}

// ======================= server sync =======================
void syncHealth() {
  String r; int code = signedRequest("GET", "/api/v1/health", "", r);
  netOk = (code == 200);
  if (!netOk) { Serial.printf("[TIME] /health -> %d %s\n", code, r.substring(0, 80).c_str()); return; }
  JsonDocument d; if (deserializeJson(d, r)) return;
  int64_t su = d["server_unix"].as<int64_t>();
  if (su <= 0) su = d["server_time"].as<int64_t>();      // accept either field name
  if (su > 1600000000LL) {
    serverOffset = su - (int64_t)(millis() / 1000);
    timeSynced = true; lastTimeSyncMs = millis();
  } else { static uint32_t tLog = 0; if (millis() - tLog > 10000) { tLog = millis(); Serial.println("[TIME] health has no server_unix/server_time: " + r.substring(0, 120)); } }
}

void syncState() {
  String r; int code = signedRequest("GET", "/api/v1/edge/" DEVICE_ID "/state", "", r);
  if (code != 200) { st.fresh = false; netOk = false; return; }
  netOk = true;
  JsonDocument d; if (deserializeJson(d, r)) return;
  st.siteId = d["site_id"] | st.siteId;
  st.siteRole = d["site_role"] | st.siteRole;
  st.planVersion = String((long)d["plan_version"].as<int64_t>());
  st.resourceState = d["resource_state"] | "";
  st.reoptRequired = d["reoptimization"]["required"] | false;
  st.mayRequest = d["reoptimization"]["device_may_request"] | false;
  st.reoptRequestId = d["reoptimization"]["request_id"] | "";
  JsonObject ix = d["active_interchange"];
  st.ixSession = ix["session_id"] | ""; st.ixState = ix["state"] | "";
  st.ixCode = ix["challenge_code"] | ""; st.ixTxn = ix["txn_id"] | ""; st.ixEir = ix["eir_no"] | "";
  st.fresh = true; st.fetchedMs = millis();
}

void parseLines(const String& s, void (*fn)(const String&)) {
  int start = 0;
  while (start < (int)s.length()) {
    int e = s.indexOf('\n', start); if (e < 0) e = s.length();
    String line = s.substring(start, e); if (line.length()) fn(line);
    start = e + 1;
  }
}
String fieldAt(const String& line, int idx) {
  int f = 0, st0 = 0;
  for (int i = 0; i <= (int)line.length(); i++) {
    if (i == (int)line.length() || line[i] == ',') { if (f == idx) return line.substring(st0, i); f++; st0 = i + 1; }
  }
  return "";
}
void addTagLine(const String& l) {
  if (cap.nTags >= MAX_TAGS) return;
  Tag& t = cap.tags[cap.nTags++]; t.ref = fieldAt(l, 0); t.ref.toUpperCase(); t.role = fieldAt(l, 1); t.entity = fieldAt(l, 2);
}
void addBranchLine(const String& l) {
  if (cap.nBr >= MAX_BRANCHES) return;
  Branch& b = cap.br[cap.nBr++];
  b.id = fieldAt(l, 0); b.kind = fieldAt(l, 1); b.trigTag = fieldAt(l, 2); b.trigTag.toUpperCase();
  b.truck = fieldAt(l, 3); b.resource = fieldAt(l, 4); b.windowStart = fieldAt(l, 5).toInt();
  b.glyph = fieldAt(l, 6); b.preApproved = fieldAt(l, 7).toInt();
}

void syncCapsule() {
  String r; int code = signedRequest("GET", "/api/v1/edge/" DEVICE_ID "/decision-capsule", "", r);
  if (code == 204) { cap.valid = false; return; }
  if (code != 200) return;                         // keep last capsule; expiry check still applies
  JsonDocument d; if (deserializeJson(d, r)) { cap.valid = false; return; }
  String brC = d["branches_canonical"] | "", tagC = d["tag_registry_canonical"] | "";
  String brD = d["branches_digest"] | "", tagD = d["tag_registry_digest"] | "";
  String signedStr = String(d["device_id"] | "") + "|" + String((long)d["capsule_version"].as<int64_t>()) + "|" +
    String((long)d["plan_version"].as<int64_t>()) + "|" + String((long)d["expires_unix"].as<int64_t>()) + "|" +
    String(d["expected_tag_ref"] | "") + "|" + String(d["work_order_id"] | "") + "|" +
    String(d["resource_id"] | "") + "|" + String(d["snapshot_hash"] | "") + "|" +
    String(d["solver_run_id"] | "") + "|" + String(d["validator_status"] | "") + "|" + brD + "|" + tagD;
  String mac = d["capsule_mac"] | "";
  bool ok = String(d["device_id"] | "") == DEVICE_ID
         && constEq(sha256Hex(brC), brD) && constEq(sha256Hex(tagC), tagD)
         && constEq(hmacHex(cfgKey, signedStr), mac)
         && String(d["validator_status"] | "") == "PASS";
  uint32_t exp = (uint32_t)d["expires_unix"].as<int64_t>();
  if (ok && clockFresh()) ok = exp > nowUnix() && (exp - nowUnix()) <= 600;
  if (!ok) {
    Serial.println("[CAP] REJECTED:");
    Serial.printf("   device_id ok : %d\n", String(d["device_id"] | "") == DEVICE_ID);
    Serial.printf("   branches dig : %d  (calc %s / got %s)\n", constEq(sha256Hex(brC), brD), sha256Hex(brC).substring(0,12).c_str(), brD.substring(0,12).c_str());
    Serial.printf("   tags dig     : %d  (calc %s / got %s)\n", constEq(sha256Hex(tagC), tagD), sha256Hex(tagC).substring(0,12).c_str(), tagD.substring(0,12).c_str());
    Serial.printf("   mac          : %d  (calc %s / got %s)\n", constEq(hmacHex(cfgKey, signedStr), mac), hmacHex(cfgKey, signedStr).substring(0,12).c_str(), mac.substring(0,12).c_str());
    Serial.printf("   validator    : %s\n", String(d["validator_status"] | "").c_str());
    Serial.printf("   expiry       : clock=%d exp=%lu now=%lu\n", clockFresh(), (unsigned long)exp, (unsigned long)nowUnix());
    Serial.println("   signed str   : " + signedStr);
    cap.valid = false; return;
  }
  cap.version = String(d["capsule_version"] | 0); cap.planVersion = String(d["plan_version"] | 0);
  cap.expires = exp; cap.expectedTag = d["expected_tag_ref"] | ""; cap.expectedTag.toUpperCase();
  cap.workOrder = d["work_order_id"] | ""; cap.resource = d["resource_id"] | "";
  cap.snapshot = d["snapshot_hash"] | ""; cap.runId = d["solver_run_id"] | ""; cap.validator = "PASS";
  cap.nTags = 0; parseLines(tagC, addTagLine);
  cap.nBr = 0; parseLines(brC, addBranchLine);
  cap.valid = true; cap.fetchedMs = millis();
}

Glyph* findGlyph(const String& id) { for (auto& g : glyphs) if (g.buf && g.id == id) return &g; return nullptr; }
void fetchGlyph(const String& id) {
  if (id.isEmpty() || findGlyph(id)) return;
  const char* keys[] = {"X-Glyph-Width", "X-Glyph-Height"};
  HTTPClient http; String dummy;
  int code = signedRequest("GET", "/api/v1/edge/" DEVICE_ID "/glyph/" + id, "", dummy, keys, 2, &http);
  if (code != 200) { http.end(); return; }
  uint16_t w = http.header("X-Glyph-Width").toInt(), h = http.header("X-Glyph-Height").toInt();
  size_t len = (w / 8) * h;
  if (w == 0 || w > 320 || w % 8 || h == 0 || h > 48) { http.end(); return; }
  uint8_t* buf = (uint8_t*)malloc(len); if (!buf) { http.end(); return; }
  auto* s = http.getStreamPtr(); size_t got = 0; uint32_t t0 = millis();
  while (got < len && millis() - t0 < 3000) { if (s->available()) got += s->readBytes(buf + got, len - got); else delay(2); }
  http.end();
  if (got != len) { free(buf); return; }
  static int slot = 0; Glyph& g = glyphs[slot]; slot = (slot + 1) % MAX_GLYPHS;
  if (g.buf) free(g.buf);
  g.id = id; g.w = w; g.h = h; g.buf = buf;
}

void syncBoard() {
  String r; int code = signedRequest("GET", "/api/v1/edge/" DEVICE_ID "/board", "", r);
  if (code != 200) return;
  JsonDocument d; if (deserializeJson(d, r)) return;
  board.planVersion = String(d["plan_version"] | 0);
  board.runId = d["solver_run_id"] | ""; board.validator = d["validator"] | "";
  board.shadow = d["qaoa_shadow"] | "NOT_RUN"; board.glyphId = d["instruction_glyph_id"] | "";
  board.n = 0;
  for (JsonObject o : d["rows"].as<JsonArray>()) {
    if (board.n >= MAX_ROWS) break;
    Row& rw = board.rows[board.n++];
    rw.seq = o["seq"] | board.n; rw.truck = o["truck_id"] | ""; rw.cont = o["container_short"] | "";
    rw.chassis = o["chassis_id"] | ""; rw.win = o["window_start_unix"] | 0; rw.status = o["status"] | "";
  }
  board.cliffCont = d["next_cliff"]["container_short"] | ""; board.cliffKind = d["next_cliff"]["kind"] | "";
  board.cliffAt = d["next_cliff"]["at_unix"] | 0;
  board.valid = true;
  fetchGlyph(board.glyphId);
}

void maybeRequestReopt() {
  if (!st.reoptRequired || !st.mayRequest || st.reoptRequestId.isEmpty() || st.reoptRequestId == st.lastReoptSent) return;
  JsonDocument d; d["request_id"] = st.reoptRequestId; d["device_id"] = DEVICE_ID; d["requested_mode"] = "RECOVERY";
  d["plan_version"] = st.planVersion.toInt();
  String b; serializeJson(d, b); String r;
  int code = signedRequest("POST", "/api/v1/edge/" DEVICE_ID "/optimization-requests", b, r);
  if (code >= 200 && code < 300) { st.lastReoptSent = st.reoptRequestId; Serial.println("[REOPT] requested"); }
}

// ======================= drawing (v13 UI) =======================
// Design: Obsidian Industrial dark theme, rounded cards, status pills, drawn icons,
// flicker-free (full redraw only when data changes; clock/timers update in place).
#define C_LINE    0x2A0A   // #294355
#define C_SURF2   0x1127   // #16273A
#define C_CYANDK  0x11C9   // #163A4A
#define C_OKBG    0x0964   // #0D2C20
#define C_WARNBG  0x3102   // #332211

const GFXfont* F_S  = &FreeSans9pt7b;
const GFXfont* F_SB = &FreeSansBold9pt7b;
const GFXfont* F_M  = &FreeSansBold12pt7b;
const GFXfont* F_L  = &FreeSansBold18pt7b;
const GFXfont* F_MONO = &FreeMonoBold9pt7b;

String lastBoardSig = "", shownCode = "";
String matchTruck, matchRes;
bool barActive = false; uint32_t barStart = 0, barDur = 1; uint16_t barColor = C_CYAN;
uint32_t tPulse = 0, tBar = 0, tWait = 0; uint8_t pulse = 0;

String hhmm(uint32_t unixT) {          // IST
  if (!unixT) return "--:--";
  uint32_t t = (unixT + 19800) % 86400; char b[6];
  snprintf(b, 6, "%02lu:%02lu", (unsigned long)(t / 3600), (unsigned long)((t / 60) % 60)); return b;
}
int txtW(const GFXfont* f, const String& s) {
  int16_t x1, y1; uint16_t w, h; tft.setFont(f); tft.setTextSize(1); tft.getTextBounds(s, 0, 0, &x1, &y1, &w, &h); return w;
}
void txt(int x, int y, const GFXfont* f, uint16_t c, const String& s) {
  tft.setFont(f); tft.setTextSize(1); tft.setTextColor(c); tft.setCursor(x, y); tft.print(s);
}
void txtR(int xr, int y, const GFXfont* f, uint16_t c, const String& s) { txt(xr - txtW(f, s), y, f, c, s); }
void txtC(int xc, int y, const GFXfont* f, uint16_t c, const String& s) { txt(xc - txtW(f, s) / 2, y, f, c, s); }
// fit text into maxW by stepping down the font
void txtFit(int x, int y, int maxW, const GFXfont* f, uint16_t c, const String& s) {
  if (txtW(f, s) <= maxW) { txt(x, y, f, c, s); return; }
  if (f != F_S && txtW(F_SB, s) <= maxW) { txt(x, y, F_SB, c, s); return; }
  if (txtW(F_S, s) <= maxW) { txt(x, y, F_S, c, s); return; }
  txt(x, y - 8, nullptr, c, s);
}
int pill(int x, int y, const String& s, uint16_t fg, uint16_t bg) {   // returns width, 16 px high
  int w = s.length() * 6 + 14;
  tft.fillRoundRect(x, y, w, 16, 8, bg);
  tft.setFont(nullptr); tft.setTextSize(1); tft.setTextColor(fg); tft.setCursor(x + 7, y + 4); tft.print(s);
  return w;
}
int pillR(int xr, int y, const String& s, uint16_t fg, uint16_t bg) { int w = s.length() * 6 + 14; pill(xr - w, y, s, fg, bg); return w; }
uint16_t tintFor(uint16_t c) { return c == C_ERR ? C_ERRBG : c == C_OK ? C_OKBG : c == C_WARN ? C_WARNBG : C_CYANDK; }

// ---------- icons ----------
void iconLogo(int cx, int cy, int r) {                 // LIRA diamond mark
  tft.fillTriangle(cx - r, cy, cx, cy - r, cx + r, cy, C_CYAN);
  tft.fillTriangle(cx - r, cy, cx, cy + r, cx + r, cy, C_CYANDK);
  tft.drawLine(cx - r, cy, cx + r, cy, C_INK);
}
void iconTruck(int x, int y, uint16_t c, uint16_t bg) {  // 34 x 21
  tft.fillRoundRect(x, y + 2, 20, 13, 2, c);
  tft.fillRoundRect(x + 21, y + 6, 12, 9, 2, c);
  tft.fillRect(x + 25, y + 8, 5, 3, bg);
  tft.fillCircle(x + 6, y + 17, 4, c);  tft.fillCircle(x + 6, y + 17, 1, bg);
  tft.fillCircle(x + 27, y + 17, 4, c); tft.fillCircle(x + 27, y + 17, 1, bg);
}
void iconCheck(int cx, int cy, uint16_t c) {
  for (int i = -2; i <= 2; i++) { tft.drawLine(cx - 11, cy + i, cx - 4, cy + 7 + i, c); tft.drawLine(cx - 4, cy + 7 + i, cx + 11, cy - 8 + i, c); }
}
void iconCross(int cx, int cy, uint16_t c) {
  for (int i = -2; i <= 2; i++) { tft.drawLine(cx - 9 + i, cy - 9, cx + 9 + i, cy + 9, c); tft.drawLine(cx + 9 + i, cy - 9, cx - 9 + i, cy + 9, c); }
}
void iconHourglass(int cx, int cy, uint16_t c) {
  tft.fillRect(cx - 11, cy - 13, 23, 3, c); tft.fillRect(cx - 11, cy + 11, 23, 3, c);
  tft.fillTriangle(cx - 9, cy - 10, cx + 9, cy - 10, cx, cy, c);
  tft.drawTriangle(cx - 9, cy + 10, cx + 9, cy + 10, cx, cy, c);
  tft.fillTriangle(cx - 5, cy + 10, cx + 5, cy + 10, cx, cy + 5, c);
}
void iconBranch(int cx, int cy, uint16_t c) {
  for (int i = -1; i <= 1; i++) { tft.drawLine(cx + i, cy + 12, cx + i, cy, c); tft.drawLine(cx + i, cy, cx - 9 + i, cy - 9, c); tft.drawLine(cx + i, cy, cx + 9 + i, cy - 9, c); }
  tft.fillCircle(cx - 10, cy - 10, 3, c); tft.fillCircle(cx + 10, cy - 10, 3, c); tft.fillCircle(cx, cy + 12, 3, c);
}
void iconContainer(int cx, int cy, uint16_t c) {
  tft.drawRect(cx - 14, cy - 9, 28, 18, c); tft.drawRect(cx - 13, cy - 8, 26, 16, c);
  for (int x = cx - 9; x <= cx + 9; x += 4) tft.drawFastVLine(x, cy - 6, 12, c);
}
void iconCard(int x, int y, uint16_t c, uint8_t waves) {  // RFID card + waves, ~30 x 18
  tft.drawRoundRect(x, y + 2, 16, 14, 2, c); tft.fillRect(x + 3, y + 6, 5, 4, c);
  for (int i = 0; i < 3; i++) tft.drawCircleHelper(x + 17, y + 9, 4 + i * 4, 0x6, i < waves ? c : C_LINE);
}
void iconWarn(int x, int y, uint16_t c) {               // 16 x 14
  tft.fillTriangle(x, y + 13, x + 8, y, x + 16, y + 13, c);
  tft.fillRect(x + 7, y + 4, 2, 5, C_WARNBG); tft.fillRect(x + 7, y + 10, 2, 2, C_WARNBG);
}
void statusBadge(int cx, int cy, uint16_t c, const String& title) {
  tft.fillCircle(cx, cy, 25, tintFor(c)); tft.drawCircle(cx, cy, 25, c); tft.drawCircle(cx, cy, 24, c);
  if (title.indexOf("HOLD") >= 0 || title.indexOf("EXPIRED") >= 0 || title.indexOf("TIMEOUT") >= 0 || title.indexOf("REJECT") >= 0) iconCross(cx, cy, c);
  else if (title.indexOf("COMMITTED") >= 0) iconCheck(cx, cy, c);
  else if (title.indexOf("PLAN") >= 0) iconBranch(cx, cy, c);
  else if (title.indexOf("MATCH") >= 0) iconHourglass(cx, cy, c);
  else if (title.indexOf("EMPTY") >= 0) iconContainer(cx, cy, c);
  else if (title.indexOf("TRUCK") >= 0) iconTruck(cx - 17, cy - 10, c, tintFor(c));
  else iconLogo(cx, cy, 14);
}

// ---------- chrome ----------
void drawClock() {
  tft.fillRect(268, 3, 50, 22, C_SURF);
  txtR(314, 19, F_SB, clockFresh() ? C_INK : C_MUTED, clockFresh() ? hhmm(nowUnix()) : "--:--");
}
void drawHeader() {
  tft.fillRect(0, 0, 320, 28, C_SURF); tft.drawFastHLine(0, 28, 320, C_LINE);
  iconLogo(14, 14, 8);
  txt(28, 20, F_SB, C_INK, "LIRA");
  String site = st.siteId; site.replace("JNPT-", ""); site.replace("DEPOT-", "");
  txt(76, 20, F_S, C_MUTED, site.substring(0, 9));
  int x = 264;
  int q = queueCount();
  if (q) x -= pillR(x, 6, "Q" + String(q) + "/6", C_BG, C_WARN) + 4;
  if (cap.valid && clockFresh()) x -= pillR(x, 6, "POLICY", C_OK, C_OKBG) + 4;
  else x -= pillR(x, 6, "NO POLICY", C_WARN, C_WARNBG) + 4;
  pillR(x, 6, netOk ? "ONLINE" : "OFFLINE", netOk ? C_OK : C_ERR, netOk ? C_OKBG : C_ERRBG);
  drawClock();
}
void drawFooter(bool tapHint) {
  tft.fillRect(0, 220, 320, 20, C_SURF); tft.drawFastHLine(0, 219, 320, C_LINE);
  String pv = cap.valid ? cap.planVersion : board.planVersion;
  String run = cap.valid ? cap.runId : board.runId;
  bool pass = cap.valid || board.validator == "PASS";
  tft.setFont(nullptr); tft.setTextSize(1); tft.setTextColor(C_MUTED); tft.setCursor(6, 226);
  tft.print("PLAN v" + pv + "  " + run + "  ");
  tft.setTextColor(pass ? C_OK : C_WARN); tft.print(pass ? "VALIDATED" : "UNVERIFIED");
  if (board.shadow == "AGREES" && !tapHint) pillR(314, 222, "QAOA AGREES", C_CYAN, C_CYANDK);
}
void drawTapHint() {               // pulsing RFID card in footer (board only)
  pulse = (pulse + 1) % 4;
  tft.fillRect(222, 221, 98, 19, C_SURF);
  iconCard(226, 221, pulse ? C_CYAN : C_MUTED, pulse);
  tft.setFont(nullptr); tft.setTextColor(C_INK); tft.setCursor(262, 227); tft.print("TAP CARD");
}
void drawGlyph(const String& id, int y, uint16_t col) {
  Glyph* g = findGlyph(id); if (!g) return;
  tft.drawBitmap((320 - g->w) / 2, y, g->buf, g->w, g->h, col);
}
void startBar(uint32_t startMs, uint32_t durMs, uint16_t c) { barActive = true; barStart = startMs; barDur = durMs; barColor = c; }
void drawTimerBar() {
  if (!barActive) return;
  uint32_t el = millis() - barStart; if (el > barDur) el = barDur;
  int w = 288L * (barDur - el) / barDur;
  uint16_t c = (barDur - el) < barDur / 5 ? C_ERR : barColor;
  tft.fillRoundRect(16, 176, 288, 5, 2, C_LINE);
  if (w > 0) tft.fillRoundRect(16, 176, w, 5, 2, c);
  tft.fillRect(262, 160, 46, 14, C_SURF);
  tft.setFont(nullptr); tft.setTextColor(c); tft.setCursor(268, 164);
  tft.print(String((barDur - el + 999) / 1000) + "s");
}

// ---------- BOARD ----------
String boardSig() {
  String s = st.siteRole + st.siteId + board.planVersion + board.runId + board.shadow + board.glyphId + String(board.cliffAt) +
             String(netOk) + String(cap.valid && clockFresh()) + String(queueCount());
  for (int i = 0; i < board.n; i++) s += board.rows[i].truck + board.rows[i].status + board.rows[i].chassis + String(board.rows[i].win);
  return s;
}
uint16_t statusCol(const String& s) { return s == "NEXT" ? C_OK : s == "HOLD" ? C_ERR : s == "AT_BAY" ? C_CYAN : C_MUTED; }
void drawCliff() {
  if (!board.cliffAt) return;
  tft.fillRoundRect(8, 150, 304, 30, 6, C_WARNBG);
  iconWarn(16, 158, C_WARN);
  tft.setFont(nullptr); tft.setTextColor(C_WARN); tft.setCursor(38, 155); tft.print(board.cliffKind == "PNR" ? String("POINT OF NO RETURN") : board.cliffKind + " CLIFF");
  tft.setTextColor(C_INK); tft.setCursor(38, 166); tft.print(board.cliffCont + "  @ " + hhmm(board.cliffAt));
  String left = "--";
  if (clockFresh()) {
    if (board.cliffAt > nowUnix()) { uint32_t m = (board.cliffAt - nowUnix()) / 60; left = String(m / 60) + "h " + (m % 60 < 10 ? "0" : "") + String(m % 60) + "m"; }
    else left = "PASSED";
    uint32_t span = 4 * 3600, rem = board.cliffAt > nowUnix() ? board.cliffAt - nowUnix() : 0; if (rem > span) rem = span;
    tft.fillRoundRect(190, 172, 112, 4, 2, C_LINE); tft.fillRoundRect(190, 172, 112L * rem / span, 4, 2, rem < 3600 ? C_ERR : C_WARN);
  }
  txtR(302, 167, F_SB, C_WARN, left);
}
void drawBoard() {
  barActive = false;
  tft.fillScreen(C_BG); drawHeader();
  bool depot = st.siteRole == "EMPTY_DEPOT";
  if (!board.valid || board.n == 0) {
    tft.fillRoundRect(8, 36, 304, 108, 10, C_SURF);
    iconHourglass(160, 70, C_WARN);
    txtC(160, 112, F_M, C_WARN, "NO APPROVED PLAN");
    txtC(160, 132, F_S, C_MUTED, "Waiting for dispatch");
    drawFooter(true); drawTapHint(); return;
  }
  // hero card: now serving
  int hi = 0;
  for (int i = 0; i < board.n; i++) if (board.rows[i].status == "NEXT") { hi = i; break; }
  Row& r = board.rows[hi];
  uint16_t sc = statusCol(r.status);
  tft.fillRoundRect(8, 34, 304, 74, 10, C_SURF);
  tft.fillRoundRect(8, 34, 6, 74, 3, sc);
  tft.setFont(nullptr); tft.setTextColor(C_MUTED); tft.setCursor(22, 42); tft.print(depot ? "EMPTY RETURN DESK" : "NOW SERVING");
  pillR(304, 39, r.status, C_BG, sc);
  if (depot) iconContainer(38, 72, C_CYAN); else iconTruck(22, 62, C_CYAN, C_SURF);
  txt(64, 84, F_L, C_INK, r.truck);
  txtR(304, 84, F_L, C_CYAN, hhmm(r.win));
  tft.setFont(nullptr); tft.setTextColor(C_MUTED); tft.setCursor(256, 90); tft.print("WINDOW");
  txt(22, 103, F_MONO, C_INK, r.cont);
  if (r.chassis.length() && r.chassis != "-") { tft.setFont(nullptr); pill(150, 91, "CHASSIS " + r.chassis, C_CYAN, C_CYANDK); }
  // up next
  int y = 114, shown = 0;
  for (int i = 0; i < board.n && shown < 2; i++) {
    if (i == hi) continue; Row& q = board.rows[i];
    tft.fillRoundRect(8, y, 304, 16, 4, C_SURF2);
    tft.setFont(nullptr); tft.setTextColor(C_MUTED); tft.setCursor(14, y + 4); tft.print(String(q.seq));
    tft.setTextColor(C_INK); tft.setCursor(28, y + 4); tft.print(q.truck);
    tft.setTextColor(C_MUTED); tft.setCursor(64, y + 4); tft.print(q.cont);
    tft.setTextColor(C_CYAN); tft.setCursor(150, y + 4); tft.print(q.chassis);
    tft.setTextColor(C_INK); tft.setCursor(196, y + 4); tft.print(hhmm(q.win));
    tft.setTextColor(statusCol(q.status)); tft.setCursor(262, y + 4); tft.print(q.status);
    y += 18; shown++;
  }
  drawCliff();
  drawGlyph(board.glyphId, 184, C_INK);
  drawFooter(true); drawTapHint();
}

// ---------- RESULT / ACTION SCREENS ----------
// title decides icon; l2 starting with "Code:" renders a custodian ticket.
void screen(const char* title, uint16_t titleCol, uint16_t bg, const String& l1, const String& l2, const String& l3,
            const String& glyphId) {
  (void)bg; barActive = false; lastBoardSig = "";
  tft.fillScreen(C_BG); drawHeader();
  tft.fillRoundRect(8, 34, 304, 152, 10, C_SURF);
  tft.fillRoundRect(8, 34, 6, 152, 3, titleCol);
  statusBadge(48, 66, titleCol, String(title));
  txtFit(84, 60, 222, F_M, titleCol, String(title));
  txtFit(84, 84, 222, F_S, C_INK, l1);
  if (l2.startsWith("Code:")) {
    String code = l2.substring(6); code.trim();
    for (int x = 22; x < 296; x += 8) { tft.drawFastHLine(x, 100, 4, C_WARN); tft.drawFastHLine(x, 146, 4, C_WARN); }
    tft.drawFastVLine(20, 100, 47, C_WARN); tft.drawFastVLine(299, 100, 47, C_WARN);
    tft.setFont(nullptr); tft.setTextColor(C_MUTED); tft.setCursor(30, 106); tft.print("CUSTODIAN CODE  -  ENTER ON WEB CONSOLE");
    txtC(160, 140, F_L, code == "..." ? C_MUTED : C_INK, code == "..." ? "waiting..." : code);
  } else {
    txtFit(22, 128, 280, F_L, C_INK, l2);
  }
  tft.setFont(nullptr); tft.setTextColor(C_MUTED); tft.setCursor(22, 162); tft.print(l3.substring(0, 39));
  drawGlyph(glyphId, 186, C_INK);
  drawFooter(false);
}

// ======================= events =======================
String buildEvent(const String& uid, const String& role, int step, const String& decision,
                  const String& reason, bool offline) {
  seqCounter++; saveCounters();
  char eid[32]; snprintf(eid, sizeof(eid), "EV-EDGE01-%06lu", (unsigned long)seqCounter);
  JsonDocument d;
  d["event_type"] = "SCAN_OBSERVED"; d["event_id"] = eid; d["device_id"] = DEVICE_ID; d["sequence"] = seqCounter;
  d["tag_ref"] = uid; d["tag_role"] = role;
  if (sess.id.length()) d["interchange_session_id"] = sess.id; else d["interchange_session_id"] = nullptr;
  d["session_step"] = step;
  d["work_order_id"] = cap.workOrder; d["plan_version"] = cap.planVersion.toInt();
  d["capsule_version"] = cap.version.toInt(); d["snapshot_hash"] = cap.snapshot;
  d["local_decision"] = decision; d["local_reason_code"] = reason;
  if (sess.branchId.length()) d["branch_id_applied"] = sess.branchId; else d["branch_id_applied"] = nullptr;
  d["offline_queued"] = offline; d["event_nonce"] = newNonce();
  d["device_time_unix"] = clockFresh() ? nowUnix() : 0;
  String out; serializeJson(d, out); return out;
}
// returns true if the server recorded it; fills interchange fields from response
bool sendEvent(const String& uid, const String& role, int step, const String& decision, const String& reason) {
  String body = buildEvent(uid, role, step, decision, reason, false), r;
  int code = signedRequest("POST", "/api/v1/edge/events", body, r);
  if (code == 200 || code == 201 || code == 202) {
    JsonDocument d; if (!deserializeJson(d, r)) {
      JsonObject ix = d["interchange"];
      st.ixState = ix["state"] | ""; st.ixCode = ix["challenge_code"] | "";
      st.ixTxn = ix["txn_id"] | ""; st.ixEir = ix["eir_no"] | "";
    }
    Serial.printf("[EV] %s -> %d %s\n", reason.c_str(), code, r.c_str());
    return true;
  }
  // offline: store the observation (never an authorization)
  String q = buildEvent(uid, role, step, decision, reason, true);
  bool ok = queuePush(q);
  Serial.printf("[EV] offline (%d) queued=%s\n", code, ok ? "yes" : "FULL");
  return false;
}

// ======================= local rules =======================
Tag* findTag(const String& uid) { for (int i = 0; i < cap.nTags; i++) if (cap.tags[i].ref == uid) return &cap.tags[i]; return nullptr; }
Tag* tagForEntity(const String& ent) { for (int i = 0; i < cap.nTags; i++) if (cap.tags[i].entity == ent) return &cap.tags[i]; return nullptr; }
Branch* branchFor(const String& kind, const String& uid) {
  for (int i = 0; i < cap.nBr; i++) if (cap.br[i].kind == kind && cap.br[i].trigTag == uid) return &cap.br[i];
  return nullptr;
}
bool policyFresh() {
  return cap.valid && clockFresh() && cap.expires > nowUnix();
}
String expectedTruck() {
  for (int i = 0; i < board.n; i++) if (board.rows[i].status == "NEXT") return board.rows[i].truck;
  return board.n ? board.rows[0].truck : "";
}
void showHold(const String& reason, const String& detail) {
  screen("HOLD", C_ERR, C_ERRBG, reason, detail, "Observation sent. No checkout. Ask the marshal.", board.glyphId);
  mode = M_RESULT; modeUntilMs = millis() + 6000;
}
void closeSession() { sess = {}; }

void onTap(String uid) {
  uid.toUpperCase();
  if (uid == lastUid && millis() - lastUidMs < 4500) return;   // duplicate suppression
  lastUid = uid; lastUidMs = millis();
  Serial.printf("[TAP] %s\n", uid.c_str());

  bool step2 = sess.open && (millis() - sess.openedMs) < STEP2_TIMEOUT_S * 1000UL;
  if (sess.open && !step2) closeSession();

  if (!policyFresh()) { sendEvent(uid, "UNKNOWN", step2 ? 2 : 1, "HOLD", "NO_VERIFIED_FRESH_POLICY");
                        showHold("NO_VERIFIED_FRESH_POLICY", "Station has no valid plan"); closeSession(); return; }
  Tag* t = findTag(uid);
  if (!t) { sendEvent(uid, "UNKNOWN", step2 ? 2 : 1, "HOLD", "UNKNOWN_TAG");
            showHold("UNKNOWN_TAG", uid); closeSession(); return; }

  // ---- depot role: single container tap ----
  if (st.siteRole == "EMPTY_DEPOT") {
    sess.id = "IX-EDGE01-" + String(++sessCounter); saveCounters();
    bool online = sendEvent(uid, t->role, 1, "MATCH_PREVIEW", t->role == "CONTAINER_TAG" ? "EMPTY_RETURN_OBSERVED" : "WRONG_TAG_ROLE");
    screen("EMPTY RETURN OBSERVED", C_CYAN, C_BG, t->entity, online ? "Waiting custodian" : "OFFLINE - queued",
           "Detention clock stops only after custodian confirms.");
    mode = M_WAIT_CUSTODIAN; waitStartMs = millis(); return;
  }

  // ---- step 1: truck card ----
  if (!step2) {
    if (t->role != "TRUCK_CARD") { sendEvent(uid, t->role, 1, "HOLD", "TAP_TRUCK_CARD_FIRST");
                                   showHold("TAP TRUCK CARD FIRST", t->entity); return; }
    sess = {}; sess.open = true; sess.openedMs = millis(); sess.truckTag = uid; sess.truckId = t->entity;
    sess.id = "IX-EDGE01-" + String(++sessCounter); saveCounters();
    String reason = "TRUCK_MATCHED";
    if (t->entity == expectedTruck()) {
      sess.expectResource = cap.resource; sess.expectEquipTag = cap.expectedTag;
    } else if (Branch* b = branchFor("TRUCK_SUBSTITUTE", uid)) {
      sess.branchId = b->id; sess.expectResource = b->resource;
      Tag* et = tagForEntity(b->resource); sess.expectEquipTag = et ? et->ref : "";
      reason = "BRANCH_" + b->id;
    } else {
      sendEvent(uid, "TRUCK_CARD", 1, "HOLD", "TRUCK_NOT_SCHEDULED");
      showHold("TRUCK_NOT_SCHEDULED", t->entity + " not next at this bay"); closeSession(); return;
    }
    bool online = sendEvent(uid, "TRUCK_CARD", 1, "MATCH_PREVIEW", reason);
    String l3 = sess.branchId.length() ? String("PLAN " + sess.branchId + " (pre-approved)" + (online ? "" : " PROVISIONAL"))
                                       : String("Session " + sess.id);
    Branch* b = sess.branchId.length() ? branchFor("TRUCK_SUBSTITUTE", uid) : nullptr;
    screen(("TRUCK " + sess.truckId + " OK").c_str(), C_OK, C_BG,
           "Now present the CHASSIS tag", sess.expectResource, l3, b ? b->glyph : board.glyphId);
    startBar(sess.openedMs, STEP2_TIMEOUT_S * 1000UL, C_CYAN);
    mode = M_TAP1; return;
  }

  // ---- step 2: equipment tag ----
  String decision = "MATCH_PREVIEW", reason = "TAG_MATCH_UNVERIFIED_CUSTODY";
  if (t->role != "EQUIPMENT_TAG") { decision = "HOLD"; reason = "EXPECTED_EQUIPMENT_TAG"; }
  else if (uid != sess.expectEquipTag) {
    if (Branch* b = branchFor("EQUIPMENT_SUBSTITUTE", uid)) { sess.branchId = b->id; sess.expectResource = b->resource; reason = "BRANCH_" + b->id; }
    else { decision = "HOLD"; reason = "TAG_MISMATCH"; }
  } else if (sess.branchId.isEmpty() && st.fresh && st.resourceState.length() &&
             st.resourceState != "INSPECTED_AVAILABLE" && st.resourceState != "RESERVED") {
    decision = "HOLD"; reason = "RESOURCE_NOT_AVAILABLE";
  } else if (st.fresh && st.planVersion != cap.planVersion) {
    decision = "HOLD"; reason = "STALE_WORK_ORDER";
  } else if (sess.branchId.length()) reason = "BRANCH_" + sess.branchId;

  bool online = sendEvent(uid, t->role, 2, decision, reason);
  if (decision == "HOLD") {
    showHold(reason, reason == "TAG_MISMATCH" ? String("Expected " + sess.expectResource + ", saw " + t->entity) : String(t->entity));
    closeSession(); return;
  }
  if (!online) {
    screen(sess.branchId.length() ? ("PLAN " + sess.branchId + " - PROVISIONAL").c_str() : "MATCH - OFFLINE",
           C_WARN, C_BG, sess.truckId + " + " + sess.expectResource, "NO CHECKOUT OFFLINE",
           "Observation queued. Reconcile when online.");
    mode = M_RESULT; modeUntilMs = millis() + 8000; closeSession(); return;
  }
  mode = M_WAIT_CUSTODIAN; waitStartMs = millis();
  matchTruck = sess.truckId; matchRes = sess.expectResource;
  showMatchWaiting();
}

void showMatchWaiting() {
  shownCode = st.ixCode;
  screen("MATCH - PREVIEW", C_WARN, C_BG, matchTruck + " + " + matchRes + "  (not checked out)",
         "Code: " + (st.ixCode.length() ? st.ixCode : String("...")), "Custodian confirms on web. No local release.");
  startBar(waitStartMs, CUSTODIAN_WAIT_S * 1000UL, C_WARN);
}
void updateWaitCustodian() {
  if (millis() - waitStartMs > CUSTODIAN_WAIT_S * 1000UL) {
    screen("EXPIRED", C_ERR, C_ERRBG, "Custodian did not confirm", "Tap again to restart", "No checkout happened.");
    mode = M_RESULT; modeUntilMs = millis() + 5000; closeSession(); return;
  }
  if (st.ixState == "COMMITTED") {
    screen("CHECKOUT COMMITTED", C_OK, C_BG, "TXN " + st.ixTxn, "EIR " + st.ixEir, "Digital EIR ingested as evidence.");
    mode = M_COMMITTED; modeUntilMs = millis() + 10000; closeSession();
  } else if (st.ixState == "REJECTED" || st.ixState == "EXPIRED") {
    showHold("CUSTODIAN " + st.ixState, "No checkout"); closeSession();
  } else if (st.ixCode != shownCode) {
    showMatchWaiting();
  }
}

// ======================= serial commands =======================
void handleSerial() {
  if (!Serial.available()) return;
  String l = Serial.readStringUntil('\n'); l.trim(); if (l.isEmpty()) return;
  if (l.startsWith("wifi ")) { int s = l.indexOf(' ', 5); cfgSsid = l.substring(5, s < 0 ? l.length() : s);
    cfgPass = s < 0 ? "" : l.substring(s + 1); saveStr("ssid", cfgSsid); saveStr("pass", cfgPass);
    Serial.println("[CFG] wifi saved, reconnecting"); WiFi.disconnect(); WiFi.begin(cfgSsid.c_str(), cfgPass.c_str()); }
  else if (l.startsWith("server ")) { cfgServer = l.substring(7); if (cfgServer.endsWith("/")) cfgServer.remove(cfgServer.length() - 1);
    saveStr("server", cfgServer); Serial.println("[CFG] server=" + cfgServer); }
  else if (l.startsWith("key ")) { cfgKey = l.substring(4); saveStr("key", cfgKey); Serial.println("[CFG] key saved (" + String(cfgKey.length()) + " chars)"); }
  else if (l.startsWith("sim ")) onTap(l.substring(4));
  else if (l == "clearq") { queueClear(); Serial.println("[Q] cleared"); }
  else if (l == "factory") { prefs.begin("lira", false); prefs.clear(); prefs.end(); Serial.println("[CFG] saved config wiped, rebooting to defaults"); delay(300); ESP.restart(); }
  else if (l == "reboot") ESP.restart();
  else if (l == "show") {
    Serial.printf("FW %s  dev %s\nWiFi %s (%s) IP %s\nserver %s\nkey %s\n", FW_VERSION, DEVICE_ID, cfgSsid.c_str(),
      WiFi.status() == WL_CONNECTED ? "up" : "down", WiFi.localIP().toString().c_str(), cfgServer.c_str(), cfgKey.length() ? "set" : "MISSING");
    Serial.printf("net=%d clock=%d cap=%d tags=%d branches=%d board_rows=%d queue=%d role=%s\n",
      netOk, clockFresh(), cap.valid, cap.nTags, cap.nBr, board.n, queueCount(), st.siteRole.c_str());
  } else Serial.println("cmds: wifi <ssid> <pass> | server <url> | key <secret> | show | sim <UID> | clearq | reboot");
}

// ======================= setup / loop =======================
void setup() {
  pinMode(TFT_CS, OUTPUT); digitalWrite(TFT_CS, HIGH);
  pinMode(RC522_SS, OUTPUT); digitalWrite(RC522_SS, HIGH);
  Serial.begin(115200); delay(200);
  Serial.printf("\nLIRA Bay Station %s (%s)\n", FW_VERSION, DEVICE_ID);
  SPI.begin(18, 19, 23);
  tft.begin(10000000); tft.setRotation(1); tft.fillScreen(C_BG);
  rfid.PCD_Init(); delay(50); rfid.PCD_SetAntennaGain(rfid.RxGain_max);
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("RC522 VersionReg=0x%02X\n", v);
  loadConfig();
  screen("LIRA BAY STATION", C_CYAN, C_BG, FW_VERSION " " DEVICE_ID,
         cfgSsid.length() ? String("Joining " + cfgSsid) : String("No Wi-Fi set"),
         (v == 0x00 || v == 0xFF) ? "RFID READER FAULT" : "RFID OK. Type 'show' in Serial.");
  WiFi.mode(WIFI_STA); WiFi.setSleep(false); WiFi.persistent(false);
  Serial.println("[WIFI] scanning...");
  int n = WiFi.scanNetworks(); bool seen = false;
  for (int i = 0; i < n; i++) {
    Serial.printf("   %-24s ch%-2d %ddBm\n", WiFi.SSID(i).c_str(), WiFi.channel(i), WiFi.RSSI(i));
    if (WiFi.SSID(i) == cfgSsid) seen = true;
  }
  Serial.printf("[WIFI] target '%s' %s\n", cfgSsid.c_str(), seen ? "FOUND" : "NOT FOUND (is the hotspot 2.4 GHz and on?)");
  WiFi.begin(cfgSsid.c_str(), cfgPass.c_str());
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) { delay(300); Serial.print("."); }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("\n[WIFI] CONNECTED  ESP32 IP=%s  server=%s\n", WiFi.localIP().toString().c_str(), cfgServer.c_str());
  else Serial.printf("\n[WIFI] FAILED status=%d (1=no SSID, 4=wrong password, 6=disconnected)\n", WiFi.status());
}

void loop() {
  handleSerial();
  uint32_t now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    netOk = false;
    if (now - tWifi > 10000 && cfgSsid.length()) { tWifi = now; WiFi.disconnect(); WiFi.begin(cfgSsid.c_str(), cfgPass.c_str()); }
  } else {
    if (now - tHealth > 30000 || !timeSynced) { tHealth = now; syncHealth(); }
    if (now - tState > (mode == M_WAIT_CUSTODIAN ? 1500UL : 5000UL)) { tState = now; syncState(); maybeRequestReopt(); }
    if (now - tCap > 11000) { tCap = now; syncCapsule(); }
    if (now - tBoard > 5000 && mode == M_BOARD) { tBoard = now; syncBoard(); }
    if (now - tQueue > 15000) { tQueue = now; queueFlush(); }
  }
  if (cap.valid && clockFresh() && cap.expires <= nowUnix()) { cap.valid = false; Serial.println("[CAP] expired"); }

  // RFID
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    char uid[24] = {0};
    for (byte i = 0; i < rfid.uid.size && i < 10; i++) sprintf(uid + i * 2, "%02X", rfid.uid.uidByte[i]);
    rfid.PICC_HaltA(); rfid.PCD_StopCrypto1();
    onTap(String(uid));
  }

  // UI state machine
  if (mode == M_TAP1 && (!sess.open || now - sess.openedMs > STEP2_TIMEOUT_S * 1000UL)) {
    closeSession(); showHold("SESSION TIMEOUT", "Chassis tag not presented in 30 s");
  }
  if (mode == M_WAIT_CUSTODIAN && now - tWait > 1000) { tWait = now; updateWaitCustodian(); }
  if ((mode == M_RESULT || mode == M_COMMITTED) && now > modeUntilMs) { mode = M_BOARD; lastBoardSig = ""; }
  if (mode == M_BOARD) {
    static uint32_t tSig = 0;
    if (lastBoardSig.isEmpty() || now - tSig > 500) { tSig = now; String sig = boardSig(); if (sig != lastBoardSig) { lastBoardSig = sig; drawBoard(); } }
    if (now - tDraw > 1000) { tDraw = now; drawClock(); drawCliff(); }
    if (now - tPulse > 450) { tPulse = now; drawTapHint(); }
  } else {
    if (now - tDraw > 1000) { tDraw = now; drawClock(); }
    if (barActive && now - tBar > 250) { tBar = now; drawTimerBar(); }
  }
}
