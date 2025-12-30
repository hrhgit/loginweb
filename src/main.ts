import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { vLazyLoad } from './directives/vLazyLoad'
import './style.css'

const app = createApp(App)
app.directive('lazy-load', vLazyLoad)
app.use(router).mount('#app')
