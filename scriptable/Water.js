// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: cyan; icon-glyph: tint;

// MyPortal → Water: how much you have drunk today against the diet plan's goal, as a small
// home-screen widget. Tap it and Scriptable asks how much you drank: +250 ml, +500 ml or another
// amount, again and again until Done. iOS redraws the widget on its own schedule, usually within
// a few minutes.
//
// Setup is in scriptable/README.md. The token is kept in the Keychain, shared with Diet.js.

const SITE = "https://www.otuzbir.world";
const TOKEN_KEY = "myportal.widgetToken";
const MAX_ML = 3000; // the site refuses more in one go: a typo of 5000 for 500

const INK = new Color("#0e1a24");
const BRAND = new Color("#17609f");
const CYAN = new Color("#2a96d4");
const LIME = new Color("#a9d22c");
const GREY = new Color("#58778e");

// ─── The site ────────────────────────────────────────────────────────────────

const savedToken = () => (Keychain.contains(TOKEN_KEY) ? Keychain.get(TOKEN_KEY) : null);

async function tell(title, message) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  a.addAction("OK");
  await a.presentAlert();
}

/**
 * First run: paste WIDGET_TOKEN, or make one to put in Vercel. Resolves to a pasted token; a new
 * one isn't on the site until Vercel has redeployed, so that run stops there (null), as on cancel.
 */
async function setUpToken() {
  const a = new Alert();
  a.title = "Connect to MyPortal";
  a.message = "The widgets sign in with WIDGET_TOKEN from Vercel. Paste it, or make a new one to add there.";
  a.addTextField("WIDGET_TOKEN");
  a.addAction("Use this token");
  a.addAction("Make a new one");
  a.addCancelAction("Cancel");
  const choice = await a.presentAlert();
  if (choice === -1) return null;
  const token = choice === 0
    ? a.textFieldValue(0).trim()
    : (UUID.string() + UUID.string()).replace(/-/g, "").toLowerCase();
  if (token.length < 32) {
    await tell("Too short", "The token needs at least 32 characters.");
    return null;
  }
  Keychain.set(TOKEN_KEY, token);
  if (choice === 1) {
    Pasteboard.copy(token);
    await tell("Token copied", "In Vercel, open the project → Settings → Environment Variables, add WIDGET_TOKEN with this value (it is on the clipboard), then redeploy. Then tap the widget again.");
    return null;
  }
  return token;
}

/** The site refused the saved token: offer to replace it. */
async function offerNewToken(message) {
  const a = new Alert();
  a.title = "Token refused";
  a.message = message;
  a.addAction("Change token");
  a.addCancelAction("Cancel");
  if ((await a.presentAlert()) === 0) await setUpToken();
}

/** A call to the site, with the token. Resolves to the JSON body; throws an Error to show. */
async function api(path, method = "GET", body) {
  const req = new Request(SITE + path);
  req.method = method;
  req.timeoutInterval = 20;
  req.headers = { Authorization: `Bearer ${savedToken()}`, "Content-Type": "application/json" };
  if (body !== undefined) req.body = JSON.stringify(body);
  // As text first, then JSON: loadString only fails when no answer came back at all, so a
  // refusal or an error page is never mistaken for the site being out of reach.
  let raw;
  try {
    raw = await req.loadString();
  } catch (e) {
    throw new Error(`Couldn't reach the site: ${(e && e.message) || e}`);
  }
  const status = req.response.statusCode;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // Not JSON: an error page from somewhere on the way. Reported below with what it said.
  }
  if (status === 401) {
    // The site says which side is wrong; the token's ends let it be compared with Vercel's.
    const t = savedToken() || "";
    const e = new Error(`${(data && data.error) || "The site refused the token."} This phone's token is ${t.slice(0, 6)}…${t.slice(-4)}.`);
    e.refused = true;
    throw e;
  }
  if (status < 200 || status >= 300 || data === null) {
    const said = raw ? `: "${raw.replace(/\s+/g, " ").slice(0, 80)}"` : "";
    throw new Error((data && data.error) || `The site answered ${status}${said}`);
  }
  return data;
}

// ─── The widget ──────────────────────────────────────────────────────────────

const litres = (ml) => (ml / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 });

function sky(widget) {
  const g = new LinearGradient();
  g.colors = [new Color("#c4d3ef"), new Color("#dcedf8"), new Color("#c1e2e6")];
  g.locations = [0, 0.5, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(0, 1);
  widget.backgroundGradient = g;
}

/** A bar of how far along the day is; lime once it is met. */
function bar(fraction, width) {
  const dc = new DrawContext();
  dc.size = new Size(width, 4);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, width, 4), 2, 2);
  dc.addPath(track);
  dc.setFillColor(new Color("#ffffff", 0.6));
  dc.fillPath();
  const f = Math.min(Math.max(fraction, 0), 1);
  if (f > 0) {
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 0, Math.max(width * f, 4), 4), 2, 2);
    dc.addPath(fill);
    dc.setFillColor(f >= 1 ? LIME : CYAN);
    dc.fillPath();
  }
  return dc.getImage();
}

function text(stack, value, font, color, lines = 1) {
  const t = stack.addText(value);
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines;
  return t;
}

function waterWidget(day, problem) {
  const w = new ListWidget();
  sky(w);
  w.setPadding(14, 14, 12, 14);
  w.url = `scriptable:///run/${encodeURIComponent(Script.name())}`;
  // Ask for a fresh look soon, so water logged in the app shows without waiting long.
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

  const head = w.addStack();
  head.centerAlignContent();
  text(head, "water", Font.lightSystemFont(15), INK);
  text(head, ".", Font.boldSystemFont(15), LIME);
  w.addSpacer();
  if (problem) {
    const t = text(w, problem, Font.systemFont(11), GREY, 7);
    t.minimumScaleFactor = 0.8;
    w.addSpacer();
    return w;
  }
  const goal = day.water.goalMl;
  const figure = w.addStack();
  figure.bottomAlignContent();
  text(figure, litres(day.water.ml), Font.lightMonospacedSystemFont(30), INK);
  text(figure, " L", Font.systemFont(13), GREY);
  text(w, goal ? `of ${litres(goal)} L` : "no goal today", Font.systemFont(10), GREY);
  w.addSpacer(6);
  if (goal) w.addImage(bar(day.water.ml / goal, 130));
  w.addSpacer(8);
  text(w, "<tap to log>", Font.regularMonospacedSystemFont(9), BRAND);
  return w;
}

// ─── Logging, in the app ─────────────────────────────────────────────────────

/** Another amount, typed. Null if cancelled; asks again while it isn't 1–3000 ml. */
async function askAmount() {
  for (;;) {
    const a = new Alert();
    a.title = "How much, in ml?";
    a.addTextField("ml").setNumberPadKeyboard();
    a.addAction("Log it");
    a.addCancelAction("Cancel");
    if ((await a.presentAlert()) === -1) return null;
    const ml = Number(a.textFieldValue(0));
    if (Number.isInteger(ml) && ml >= 1 && ml <= MAX_ML) return ml;
    await tell("Not an amount", `Enter a whole number of ml, from 1 to ${MAX_ML}.`);
  }
}

async function logWater() {
  let day = await api("/api/self-care/day");
  for (;;) {
    const a = new Alert();
    a.title = day.water.goalMl
      ? `${litres(day.water.ml)} of ${litres(day.water.goalMl)} L today`
      : `${litres(day.water.ml)} L today`;
    a.message = "How much did you drink?";
    a.addAction("+250 ml");
    a.addAction("+500 ml");
    a.addAction("Another amount…");
    a.addCancelAction("Done");
    const choice = await a.presentAlert();
    if (choice === -1) return;
    const ml = choice === 2 ? await askAmount() : [250, 500][choice];
    if (ml === null) continue;
    await api("/api/self-care/water", "POST", { date: day.date, ml });
    day = await api("/api/self-care/day");
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

if (config.runsInWidget) {
  let widget;
  if (!savedToken()) {
    widget = waterWidget(null, "Tap to connect this widget to the site.");
  } else {
    try {
      widget = waterWidget(await api("/api/self-care/day"));
    } catch (e) {
      widget = waterWidget(null, e.message);
    }
  }
  Script.setWidget(widget);
} else {
  const token = savedToken() || (await setUpToken());
  if (token) {
    try {
      await logWater();
    } catch (e) {
      if (e.refused) await offerNewToken(e.message);
      else await tell("Couldn't log that", e.message);
    }
  }
}
Script.complete();
