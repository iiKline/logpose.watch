# 🏴‍☠️ One Piece Journey Tracker

A sleek, fully offline-capable Progressive Web App (PWA) designed to log the grand voyage from Romance Dawn all the way to Elbaf and beyond. 

Built by **Karan**.
Maintained by **Kline**.

## ✨ Features

* **Complete Offline Support:** Installed directly to the home screen as a PWA using a custom Service Worker. It works flawlessly without an internet connection.
* **Dynamic Episode Fetching:** Automatically pulls the latest total aired episode count using the Jikan API (MyAnimeList), with a resilient GraphQL fallback to AniList.
* **Local First & Secure:** All progress and Captain's Log notes are saved instantly to the browser's `localStorage`. No accounts, no servers, no tracking.
* **Save Backups:** Full JSON Export and Import functionality to safely back up your journey or migrate to a new device.
* **Smart UI/UX:** Features a live countdown to upcoming arcs (like Elbaf), smooth CSS GPU-accelerated wave animations, text-based arc searching, and keyboard/screen-reader accessibility.

## 🛠️ How I Made It

I wanted a lightweight, custom solution for my fresh rewatch of the series, without relying on bloated tracking sites or heavy web frameworks. 

* **Tech Stack:** 100% Vanilla Web Technologies—just HTML, CSS (utilizing modern CSS variables and flex/grid layouts), and JavaScript. 
* **AI Collaboration:** I used AI for the coding.
* **Deployment:** Hosted seamlessly via GitHub Pages.

## ⚓ Installation 

Since this is a PWA, you don't need an app store to install it.

1. Navigate to the live GitHub Pages link on your mobile browser (Safari for iOS, Chrome for Android).
2. Open your browser's share or settings menu.
3. Tap **"Add to Home Screen"**.
4. Set sail! The app will now launch natively from your home screen and work offline.

---
*"I'm going to be King of the Pirates!"*
