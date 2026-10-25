// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: utensils;

// MyPortal → Diet: today's meals from the diet plan as a home-screen widget, ticked off as you eat.
//
// Large: every meal; tap one to tick it off (or back on). Medium: the next meals still to eat.
// Small: kcal eaten and the next meal. iOS opens Scriptable on any tap — widgets can't run code in
// place — so a tapped meal is ticked there, and then the day's checklist shows for more. iOS
// redraws the widget on its own schedule, usually within a few minutes.
//
// Setup is in scriptable/README.md. The token is kept in the Keychain, shared with Water.js.

const SITE = "https://www.sadwankel.site";
const TOKEN_KEY = "myportal.widgetToken";

// Soft Club, as on the site: navy ink, the brand blue for small text (cyan fails as text), cyan
// and lime as lights only.
const INK = new Color("#0e1a24");
const BRAND = new Color("#17609f");
const CYAN = new Color("#2a96d4");
const LIME = new Color("#a9d22c");
const GREY = new Color("#58778e");
const FAINT = new Color("#7b9bb1");

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

const kcal = (n) => n.toLocaleString("en-US");
// The menu's kcal in brackets make a row too long for a widget; the checklist keeps them.
const short = (what) => what.replace(/ \(\d+\)/g, "");
const tickUrl = (date, meal) =>
  `scriptable:///run/${encodeURIComponent(Script.name())}?date=${date}&meal=${encodeURIComponent(meal.key)}&checked=${meal.checked ? 0 : 1}`;

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

/** A rule running off to the right, fading as it goes. */
function rule(width) {
  const dc = new DrawContext();
  dc.size = new Size(width, 1);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    dc.setFillColor(new Color("#17609f", 0.55 * (1 - i / steps)));
    dc.fillRect(new Rect((width / steps) * i, 0, width / steps, 1));
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

/** "today's meals." with its lime full stop, and a `<label>` to the right. */
function heading(widget, title, label, size) {
  const row = widget.addStack();
  row.centerAlignContent();
  text(row, title, Font.lightSystemFont(size), INK);
  text(row, ".", Font.boldSystemFont(size), LIME);
  row.addSpacer();
  if (label) text(row, `<${label}>`, Font.regularMonospacedSystemFont(9), BRAND);
}

function message(widget, title, body) {
  heading(widget, title, null, 15);
  widget.addSpacer(6);
  text(widget, body, Font.systemFont(12), GREY, 6);
  widget.addSpacer();
}

function mealRow(widget, date, meal, lines) {
  const row = widget.addStack();
  row.spacing = 6;
  row.url = tickUrl(date, meal);
  const mark = row.addImage(SFSymbol.named(meal.checked ? "checkmark.square.fill" : "square").image);
  mark.imageSize = new Size(12, 12);
  mark.tintColor = meal.checked ? BRAND : FAINT;
  const time = row.addStack();
  time.size = new Size(60, 0);
  const t = text(time, meal.time.toLowerCase(), Font.regularMonospacedSystemFont(9), BRAND);
  t.minimumScaleFactor = 0.7;
  time.addSpacer();
  const what = text(row, short(meal.what), Font.systemFont(11), meal.checked ? FAINT : INK, lines);
  what.minimumScaleFactor = 0.85;
  row.addSpacer();
  if (meal.kcal !== null) text(row, kcal(meal.kcal), Font.regularMonospacedSystemFont(9), meal.checked ? FAINT : GREY);
}

function dietWidget(day) {
  const w = new ListWidget();
  sky(w);
  w.setPadding(14, 14, 12, 14);
  // Ask for a fresh look soon, so a tick made in the app shows without waiting long.
  w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
  const family = config.widgetFamily || "large";
  const open = `scriptable:///run/${encodeURIComponent(Script.name())}`;

  if (!day.total) {
    message(w, "meals", "No meal plan for today yet.");
    w.url = open;
    return w;
  }
  const meals = day.meals.filter((m) => !m.home);
  const left = meals.filter((m) => !m.checked);
  const figures = `${kcal(day.eaten.kcal)} / ${kcal(day.total.kcal)}`;

  if (family === "small") {
    w.url = open;
    text(w, `<${day.kind} day>`, Font.regularMonospacedSystemFont(9), BRAND);
    w.addSpacer(4);
    text(w, kcal(day.eaten.kcal), Font.lightMonospacedSystemFont(26), INK);
    text(w, `of ${kcal(day.total.kcal)} kcal`, Font.systemFont(10), GREY);
    w.addSpacer(6);
    w.addImage(bar(day.eaten.kcal / day.total.kcal, 130));
    w.addSpacer();
    const next = left[0];
    text(w, next ? `next · ${next.time.toLowerCase()}` : "all eaten", Font.regularMonospacedSystemFont(9), BRAND);
    if (next) text(w, short(next.what), Font.systemFont(11), INK, 2);
    return w;
  }

  heading(w, family === "medium" ? "meals" : "today's meals", `${day.kind} day`, family === "medium" ? 15 : 17);
  w.addSpacer(4);
  const top = w.addStack();
  top.bottomAlignContent();
  text(top, figures, Font.lightMonospacedSystemFont(family === "medium" ? 15 : 19), INK);
  text(top, " kcal", Font.systemFont(10), GREY);
  top.addSpacer();
  text(top, `~${day.eaten.protein} / ~${day.total.protein} g protein`, Font.systemFont(10), GREY);
  w.addSpacer(5);
  w.addImage(bar(day.eaten.kcal / day.total.kcal, 300));
  w.addSpacer(family === "medium" ? 6 : 8);

  if (family === "medium") {
    if (left.length === 0) text(w, "All eaten.", Font.systemFont(12), GREY);
    for (const meal of left.slice(0, 3)) {
      mealRow(w, day.date, meal, 1);
      w.addSpacer(4);
    }
  } else {
    w.addImage(rule(300));
    w.addSpacer(6);
    for (const meal of meals) {
      mealRow(w, day.date, meal, 2);
      w.addSpacer(5);
    }
  }
  w.addSpacer();
  return w;
}

// ─── The checklist, in the app ───────────────────────────────────────────────

async function checklist(date) {
  let day = await api(`/api/self-care/day${date ? `?date=${date}` : ""}`);
  const table = new UITable();
  table.showSeparators = true;

  const render = () => {
    table.removeAllRows();
    const head = new UITableRow();
    head.isHeader = true;
    head.height = 60;
    head.addText(
      day.total ? `${kcal(day.eaten.kcal)} of ${kcal(day.total.kcal)} kcal` : "No meal plan for this day",
      day.total ? `~${day.eaten.protein} of ~${day.total.protein} g protein · ${day.kind} day` : day.date,
    );
    table.addRow(head);
    if (day.note) {
      const note = new UITableRow();
      note.height = 70;
      note.addText(day.note).titleFont = Font.systemFont(13);
      table.addRow(note);
    }
    let homeHeader = false;
    for (const meal of day.meals) {
      if (meal.home && !homeHeader) {
        homeHeader = true;
        const h = new UITableRow();
        h.isHeader = true;
        h.addText("Weekends at home");
        table.addRow(h);
      }
      const row = new UITableRow();
      row.height = 72;
      row.dismissOnSelect = false;
      const mark = row.addText(meal.checked ? "✓" : "○");
      mark.widthWeight = 8;
      mark.titleColor = meal.checked ? BRAND : FAINT;
      const cell = row.addText(meal.what, `${meal.time}${meal.kcal === null ? "" : ` · ${kcal(meal.kcal)} kcal`}`);
      cell.widthWeight = 92;
      cell.titleFont = Font.systemFont(14);
      cell.titleColor = meal.checked ? FAINT : INK;
      cell.subtitleColor = BRAND;
      row.onSelect = async () => {
        const on = !meal.checked;
        meal.checked = on;
        render();
        try {
          await api("/api/self-care/meals", "PUT", { date: day.date, meal: meal.key, checked: on });
          day = await api(`/api/self-care/day?date=${day.date}`);
        } catch (e) {
          meal.checked = !on;
          await tell("Couldn't save that", e.message);
        }
        render();
      };
      table.addRow(row);
    }
    table.reload();
  };

  render();
  await table.present(false);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

if (config.runsInWidget) {
  let widget;
  if (!savedToken()) {
    widget = new ListWidget();
    sky(widget);
    message(widget, "meals", "Tap to connect this widget to the site.");
  } else {
    try {
      widget = dietWidget(await api("/api/self-care/day"));
    } catch (e) {
      widget = new ListWidget();
      sky(widget);
      message(widget, "meals", e.message);
    }
  }
  // Without this a tap on a problem only opened Scriptable; now it runs Diet, which can fix it.
  if (!widget.url) widget.url = `scriptable:///run/${encodeURIComponent(Script.name())}`;
  Script.setWidget(widget);
} else {
  // From the app, or a tap on the widget: tick the tapped meal, then show the day's checklist.
  const token = savedToken() || (await setUpToken());
  if (token) {
    const q = args.queryParameters;
    try {
      if (q.meal) await api("/api/self-care/meals", "PUT", { date: q.date, meal: q.meal, checked: q.checked === "1" });
      await checklist(q.date);
    } catch (e) {
      if (e.refused) await offerNewToken(e.message);
      else await tell("Couldn't do that", e.message);
    }
  }
}
Script.complete();
