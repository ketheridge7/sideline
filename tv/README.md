# Sideline for Google TV

Thin overlay shell. Fantasy data stays on the PC; this app is a transparent WebView pointed at Sideline's LAN overlay URL.

## Build

Open `tv/` in Android Studio (Hedgehog or newer), or from this folder:

```bash
./gradlew :app:installDebug
```

On Windows, enable **Wireless debugging** on the Google TV (Settings → System → About → build number 7×, then Developer options), then:

```bash
adb connect <tv-ip>:5555
./gradlew :app:installDebug
```

## First run on the TV

1. In Sideline on the PC: Connect → **Allow devices on this Wi-Fi to load the overlay**. Note the **6-digit pairing code**.
2. On the TV: Settings → Apps → Special app access → Display over other apps → Sideline → Allow.
   If that settings page is missing, the app will say so — use the same path manually.
3. Enter the 6-digit code with the D-pad and choose **Pair**. The app finds the PC on this Wi-Fi, then loads the HUD (`?tv=1`).
   Advanced host / port / token fields remain as a fallback.
4. **Show test overlay** draws a red box over whatever is on screen. Confirm the D-pad still controls the app underneath.
5. Check the red box over the launcher, then YouTube TV (or your football app), then Netflix. If video goes black, stop — DRM compositing failed on this device.
6. **Start HUD** loads the transparent overlay from the PC if pairing did not already start it.

The PC must stay awake. Windows Firewall may prompt the first time LAN overlay is enabled.

## Layout

The WebView is inset 48dp from the edges (title-safe). The page uses `?tv=1` for ten-foot type.
