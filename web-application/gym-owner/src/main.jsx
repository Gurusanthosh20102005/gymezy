import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App as AntdApp } from 'antd';
import { store } from './redux/store';
import { ThemeProvider } from './theme/ThemeContext';
import './index.css';
import App from './App.jsx';

const autoResizeTextarea = (el) => {
  if (!el || el.tagName !== 'TEXTAREA') return;
  el.style.resize = 'none';
  el.style.overflowY = 'hidden';
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};
document.addEventListener('input', (e) => autoResizeTextarea(e.target));
document.addEventListener('focusin', (e) => autoResizeTextarea(e.target));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <AntdApp>
          <App />
        </AntdApp>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);
