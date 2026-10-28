import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';

const root = document.querySelector<HTMLElement>('#app');
if (!root) {
  throw new Error('WaveWorks could not find the #app element.');
}

new App(root);

registerSW({ immediate: true });
