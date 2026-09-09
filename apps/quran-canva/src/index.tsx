import React from 'react'
import { createRoot } from 'react-dom/client'
import { AppI18nProvider } from '@canva/app-i18n-kit'
import { AppUiProvider } from '@canva/app-ui-kit'
import '@canva/app-ui-kit/styles.css'
import { App } from './app'

createRoot(document.getElementById('root') as Element).render(
  <AppI18nProvider>
    <AppUiProvider>
      <App />
    </AppUiProvider>
  </AppI18nProvider>
)
