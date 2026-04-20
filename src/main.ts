import { IDSCheckWidget } from './widget';

// Initialize the widget when loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new IDSCheckWidget();
  });
} else {
  new IDSCheckWidget();
}

export { IDSCheckWidget };
