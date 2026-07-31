import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// Service-worker registration lives in UpdatePrompt.vue (useRegisterSW), so the
// "new version available" state is reactive and drives the manual Update button.
createApp(App).mount('#app')
