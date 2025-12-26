import { createRouter, createWebHistory } from 'vue-router'
import EventsPage from './pages/EventsPage.vue'
import EventDetailPage from './pages/EventDetailPage.vue'
import EventEditPage from './pages/EventEditPage.vue'
import ProfilePage from './pages/ProfilePage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/events' },
    { path: '/events', name: 'events', component: EventsPage },
    { path: '/events/mine', name: 'my-events', component: () => import('./pages/MyEventsPage.vue') },
    { path: '/events/:id', name: 'event-detail', component: EventDetailPage },
    { path: '/events/:id/edit', name: 'event-edit', component: EventEditPage },
    { path: '/me', name: 'profile', component: ProfilePage },
    { path: '/:pathMatch(.*)*', redirect: '/events' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
