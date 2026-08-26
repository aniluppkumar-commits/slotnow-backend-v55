# SlotNow Clinic Waiting Screen — Kiosk / Smart-TV Setup Guide

This guide covers how to lock down a **Fire TV Stick**, **Chromecast with Google TV**,
or an Android TV / smart-TV browser to display the SlotNow **Waiting Screen**
(`/waiting/:provider_id`) as a 24×7 clinic display.

> **Public URL format**
> `https://app.slotnow.in/waiting/<provider_id>?refresh=5[&staff=<id1>,<id2>][&mute=1]`
>
> - `refresh` — seconds between token polls (default `5`, min `2`).
> - `staff`  — comma-separated staff ids when you want to pin specific doctors on a multi-doctor screen.
> - `mute=1` — disable chime + voice announcement (skips the "Enable Sound" overlay).

---

## 1. Fire TV Stick (Recommended)

Amazon Silk browser is the smoothest way to run the waiting screen on Fire TV. It
supports HTML5 audio, `SpeechSynthesis`, and full-screen mode.

1. **Install Silk Browser**
   From the Fire TV home screen → **Find** → **Search** → type `Silk Browser`
   → install the free Amazon Silk Browser app.
2. **Open the waiting URL** in Silk and press **⋮ (menu)** → **Add to Home Screen**
   so you can relaunch it in one click.
3. **Enter full-screen** with the Silk menu → **Enter Fullscreen**.
4. **Enable Sound** on first load by clicking anywhere with the remote — this
   satisfies the browser autoplay policy so chimes + voice announcements work.
5. **Prevent screensaver**:
   Settings → **Display & Sounds** → **Screensaver** → **Start After** → **Never**.
   Settings → **Preferences** → **Sleep** → **Never**.

### Auto-launch on boot (optional)

Install **Launcher Manager** or **AutoStart** from the Amazon Appstore, add Silk
Browser to the auto-launch list, and enable "Launch on power-on".

---

## 2. Chromecast with Google TV

1. Install **Google Chrome** or **Puffin TV Browser** from the Play Store.
2. Open the SlotNow Waiting Screen URL.
3. Press **F11 / full-screen icon** (Puffin) or use the address-bar → three-dot →
   **Cast full screen** for Chrome.
4. Tap the remote once to unlock sound.
5. Disable sleep: **Settings** → **System** → **Display & Sound** →
   **Advanced display settings** → **Screensaver** → **Never**.

---

## 3. Any Android Smart TV / Google TV

1. Install the **Puffin TV Browser** (free) — has the best remote-friendly UI.
2. Enter the SlotNow Waiting URL, mark it as a **Favourite** for one-click access.
3. On first load, press the OK button to satisfy the audio autoplay policy.
4. Turn off screensaver + auto-sleep from the TV's system settings.

---

## 4. Windows / Linux Mini-PC connected to a TV

Best-in-class for zero-lag audio, TTS voices, and multiple monitors.

1. Install **Google Chrome** (or Edge).
2. Create a desktop shortcut with:
   ```
   chrome.exe --kiosk --autoplay-policy=no-user-gesture-required "https://app.slotnow.in/waiting/<provider_id>?refresh=5"
   ```
   The `--kiosk` flag hides the address bar; `--autoplay-policy=no-user-gesture-required`
   removes the "Enable Sound" tap on boot.
3. Windows: **Settings → Power & battery → Screen and sleep** → set all to **Never**.
   Linux: `xset s off && xset -dpms && xset s noblank` in your session `.xprofile`.
4. Put the shortcut in `shell:startup` (Windows) or an autostart `.desktop` entry (Linux)
   so it launches after reboot.

---

## 5. Sound + Voice troubleshooting

| Symptom                                 | Fix                                                                                  |
|-----------------------------------------|--------------------------------------------------------------------------------------|
| No chime on token advance               | Click / tap the "Enable Sound" overlay once. Add `?mute=1` if silent kiosk is wanted. |
| Voice announcement plays wrong language | Install / enable **English (India)** TTS voice from the TV's Accessibility settings.  |
| Chime cuts off mid-tone                 | Increase TV audio buffer, disable HDMI-audio "eco mode" if available.                 |
| Voice overlaps the chime                | The screen already delays speech 900 ms after the chime — no action needed.          |

---

## 6. Multi-doctor kiosks

Multi-doctor mode automatically activates when the clinic has 2 or 3 active staff
records that day. To pin a specific ordering, pass their staff IDs:

```
/waiting/<provider_id>?staff=<id1>,<id2>,<id3>&refresh=5
```

Set **Cabin labels** in your dashboard (**Hospital Staff → Add / Edit doctor → Cabin**)
so the waiting screen shows *Cabin 101* instead of *Cabin A*.

---

## 7. Emergency fallback

If your internet drops, the last-known snapshot is cached in the browser and
continues to display until connectivity returns. A subtle **`offline`** badge
appears next to the time so front-desk staff know to check the router.

For any issue email **support@slotnow.in**.
