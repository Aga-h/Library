# Phone widgets (Scriptable)

Two home-screen widgets for the Diet tab, run by the [Scriptable](https://scriptable.app) app:

| Script | Widget size | Shows | A tap |
|---|---|---|---|
| `Diet.js` | Large (medium and small work too) | Today's meals with ticks, kcal eaten of the plan | On a meal: ticks it off (or back on), then shows the day's checklist to tick more |
| `Water.js` | Small | Litres drunk of the day's goal | Asks how much: +250 ml, +500 ml or another amount, until Done |

iOS widgets can't run code where they sit, so every tap opens Scriptable for a moment. iOS also
decides when a widget redraws: a tick or a glass of water shows on the widget within a few minutes,
not instantly. The site shows it straight away.

## Setup, once

1. **Add the scripts.** Save `Diet.js` and `Water.js` into iCloud Drive › Scriptable (they appear
   in Scriptable as Diet and Water), or make two new scripts in Scriptable named Diet and Water and
   paste each file in.
2. **Connect them.** Run Diet in Scriptable and tap **Make a new one**. The token is copied.
3. **Give the site the token.** In Vercel, open the project → Settings → Environment Variables, add
   `WIDGET_TOKEN` with the copied value, and redeploy. (Already have one? Choose **Use this token**
   in step 2 and paste it instead.)
4. **Add the widgets.** Long-press the home screen → + → Scriptable. Add a large one and set its
   Script to Diet, and a small one set to Water. Leave "When Interacting" as it is: the scripts set
   their own taps.

The token sits in the iOS Keychain, so Water finds the one Diet saved. It opens three calls and
nothing else: reading the day, ticking a meal, logging water (`WIDGET_ROUTES` in `lib/session.ts`).
Changing `WIDGET_TOKEN` in Vercel locks out a lost phone; on the next tap the scripts offer to
change the token.
