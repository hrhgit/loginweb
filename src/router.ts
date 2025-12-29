import { createRouter, createWebHistory } from 'vue-router'
import EventsPage from './pages/EventsPage.vue'
import EventDetailPage from './pages/EventDetailPage.vue'
import EventEditPage from './pages/EventEditPage.vue'
import ProfilePage from './pages/ProfilePage.vue'
import NotFoundPage from './pages/NotFoundPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/events' },
    { path: '/events', name: 'events', component: EventsPage },
    { path: '/events/mine', name: 'my-events', component: () => import('./pages/MyEventsPage.vue') },
    { path: '/events/:id', name: 'event-detail-intro', component: EventDetailPage, props: { tab: 'intro' } },
    { path: '/events/:id/registration', name: 'event-detail-registration', component: EventDetailPage, props: { tab: 'registration' } },
    { path: '/events/:id/form', name: 'event-detail-form', component: EventDetailPage, props: { tab: 'form' } },
    { path: '/events/:id/team', name: 'event-detail-team', component: EventDetailPage, props: { tab: 'team' } },
    { path: '/events/:id/team/create', name: 'event-team-create', component: () => import('./pages/TeamCreatePage.vue') },
    { path: '/events/:id/team/:teamId/edit', name: 'event-team-edit', component: () => import('./pages/TeamCreatePage.vue') },
    { path: '/events/:id/team/:teamId', name: 'event-team-detail', component: () => import('./pages/TeamDetailPage.vue') },
    { path: '/events/:id/showcase', name: 'event-detail-showcase', component: EventDetailPage, props: { tab: 'showcase' } },
    { path: '/events/:id/admin', name: 'event-admin', component: () => import('./pages/EventAdminPageSimple.vue') },
    {
      path: '/events/:eventId/submissions/:submissionId',
      name: 'submission-detail',
      component: () => import('./pages/SubmissionDetailPage.vue'),
    },
    {
      path: '/events/:id/submit',
      name: 'event-submit',
      component: () => import('./pages/SubmissionPage.vue'),
    },
    {
      path: '/events/:eventId/submissions/:submissionId/edit',
      name: 'submission-edit',
      component: () => import('./pages/SubmissionPage.vue'),
    },
    { path: '/events/:id/edit', name: 'event-edit', component: EventEditPage },
    { path: '/me', redirect: '/me/profile' },
    { path: '/me/profile', name: 'me-profile', component: ProfilePage, props: { tab: 'profile' } },
    { path: '/me/security', name: 'me-security', component: ProfilePage, props: { tab: 'security' } },
    { path: '/me/notifications', name: 'me-notifications', component: ProfilePage, props: { tab: 'notifications' } },
    { path: '/me/teams', name: 'me-teams', component: ProfilePage, props: { tab: 'teams' } },
    { path: '/me/joined', name: 'me-joined', component: ProfilePage, props: { tab: 'joined' } },
    { path: '/me/created', name: 'me-created', component: ProfilePage, props: { tab: 'created' } },
    { 
      path: '/404', 
      name: 'not-found', 
      component: NotFoundPage,
      props: route => ({
        message: route.query.message as string,
        backRoute: route.query.backRoute as string,
        backLabel: route.query.backLabel as string
      })
    },
    { path: '/:pathMatch(.*)*', redirect: to => {
        // For submission detail routes that don't exist, redirect to 404 with context
        if (to.path.match(/^\/events\/[^/]+\/submissions\/[^/]+$/)) {
          const eventId = to.path.split('/')[2]
          return {
            name: 'not-found',
            query: {
              message: '未找到指定的作品，可能已被删除或您没有访问权限。',
              backRoute: `/events/${eventId}/showcase`,
              backLabel: '返回作品展示'
            }
          }
        }
        // For event routes that don't exist
        if (to.path.match(/^\/events\/[^/]+/)) {
          return {
            name: 'not-found',
            query: {
              message: '活动不存在或已被删除。',
              backRoute: '/events',
              backLabel: '返回活动列表'
            }
          }
        }
        // Default fallback
        return '/events'
      }
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
