// Точка входа: стили, приложение и связь с нативной оболочкой (Capacitor)
import './styles/style.css';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { startApp } from './app/app.js';

startApp();

if (Capacitor.isNativePlatform()) {
  // «Назад» на Android: закрыть окно / пауза / выйти
  App.addListener('backButton', () => {
    if (!(window.onAndroidBack && window.onAndroidBack())) App.exitApp();
  });
  // Свернули приложение — ставим смену на паузу
  App.addListener('pause', () => window.onAndroidPause && window.onAndroidPause());
}
