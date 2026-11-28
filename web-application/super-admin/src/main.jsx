import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './redux/store';
import App from './App.jsx';
import { ThemeProvider } from './theme/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const autoResizeTextarea = (el) => {
  if (!el || el.tagName !== 'TEXTAREA') return;
  el.style.resize = 'none';
  el.style.overflowY = 'hidden';
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};
document.addEventListener('input', (e) => autoResizeTextarea(e.target));
document.addEventListener('focusin', (e) => autoResizeTextarea(e.target));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
