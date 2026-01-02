import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { useAppStore } from './store/appStore'
import { 
  createRouteComponentLoader, 
  wrapDynamicImport,
  type ModuleLoadOptions 
} from './utils/moduleLoadingUtils'
import { RouterEnhancer, type RouterEnhancementOptions } from './utils/enhancedRouter'

// Default module loading options for all routes
const defaultModuleLoadOptions: ModuleLoadOptions = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000,
  showErrorDetails: true,
  enableFallback: true
}

// Enhanced lazy loading with error handling for route components
const EventsPage = createRouteComponentLoader(
  () => import('./pages/EventsPage.vue'),
  '/pages/EventsPage.vue',
  defaultModuleLoadOptions
)

const EventDetailPage = createRouteComponentLoader(
  () => import('./pages/EventDetailPage.vue'),
  '/pages/EventDetailPage.vue',
  defaultModuleLoadOptions
)

const EventEditPage = createRouteComponentLoader(
  () => import('./pages/EventEditPage.vue'),
  '/pages/EventEditPage.vue',
  defaultModuleLoadOptions
)

const ProfilePage = createRouteComponentLoader(
  () => import('./pages/ProfilePage.vue'),
  '/pages/ProfilePage.vue',
  defaultModuleLoadOptions
)

const NotFoundPage = createRouteComponentLoader(
  () => import('./pages/NotFoundPage.vue'),
  '/pages/NotFoundPage.vue',
  defaultModuleLoadOptions
)

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/events' },
    { path: '/events', name: 'events', component: EventsPage },
    { 
      path: '/events/mine', 
      name: 'my-events', 
      component: createRouteComponentLoader(
        () => import('./pages/MyEventsPage.vue'),
        '/pages/MyEventsPage.vue',
        defaultModuleLoadOptions
      )
    },
    { 
      path: '/debug/events', 
      name: 'debug-events', 
      component: createRouteComponentLoader(
        () => import('./pages/DebugEventsPage.vue'),
        '/pages/DebugEventsPage.vue',
        defaultModuleLoadOptions
      )
    },
    { path: '/events/:id', name: 'event-detail-intro', component: EventDetailPage, props: { tab: 'intro' } },
    { path: '/events/:id/registration', name: 'event-detail-registration', component: EventDetailPage, props: { tab: 'registration' } },
    { path: '/events/:id/form', name: 'event-detail-form', component: EventDetailPage, props: { tab: 'form' } },
    { path: '/events/:id/team', name: 'event-detail-team', component: EventDetailPage, props: { tab: 'team' } },
    { 
      path: '/events/:id/team/create', 
      name: 'event-team-create', 
      component: createRouteComponentLoader(
        () => import('./pages/TeamCreatePage.vue'),
        '/pages/TeamCreatePage.vue',
        defaultModuleLoadOptions
      )
    },
    { 
      path: '/events/:id/team/:teamId/edit', 
      name: 'event-team-edit', 
      component: createRouteComponentLoader(
        () => import('./pages/TeamCreatePage.vue'),
        '/pages/TeamCreatePage.vue',
        defaultModuleLoadOptions
      )
    },
    { 
      path: '/events/:id/team/:teamId', 
      name: 'event-team-detail', 
      component: createRouteComponentLoader(
        () => import('./pages/TeamDetailPage.vue'),
        '/pages/TeamDetailPage.vue',
        defaultModuleLoadOptions
      )
    },
    { path: '/events/:id/showcase', name: 'event-detail-showcase', component: EventDetailPage, props: { tab: 'showcase' } },
    { 
      path: '/events/:id/admin', 
      name: 'event-admin', 
      component: createRouteComponentLoader(
        () => import('./pages/EventAdminPage.vue'),
        '/pages/EventAdminPage.vue',
        defaultModuleLoadOptions
      )
    },
    {
      path: '/events/:eventId/judge',
      name: 'judge-workspace',
      component: createRouteComponentLoader(
        () => import('./pages/JudgeWorkspacePage.vue'),
        '/pages/JudgeWorkspacePage.vue',
        defaultModuleLoadOptions
      )
    },
    {
      path: '/events/:eventId/submissions/:submissionId',
      name: 'submission-detail',
      component: createRouteComponentLoader(
        () => import('./pages/SubmissionDetailPage.vue'),
        '/pages/SubmissionDetailPage.vue',
        defaultModuleLoadOptions
      ),
    },
    {
      path: '/events/:id/submit',
      name: 'event-submit',
      component: createRouteComponentLoader(
        () => import('./pages/SubmissionPage.vue'),
        '/pages/SubmissionPage.vue',
        defaultModuleLoadOptions
      ),
    },
    {
      path: '/events/:eventId/submissions/:submissionId/edit',
      name: 'submission-edit',
      component: createRouteComponentLoader(
        () => import('./pages/SubmissionPage.vue'),
        '/pages/SubmissionPage.vue',
        defaultModuleLoadOptions
      ),
    },
    { path: '/events/:id/edit', name: 'event-edit', component: EventEditPage },
    { 
      path: '/demo/vue-query', 
      name: 'vue-query-demo', 
      component: createRouteComponentLoader(
        () => import('./pages/VueQueryDemoPage.vue'),
        '/pages/VueQueryDemoPage.vue',
        defaultModuleLoadOptions
      )
    },
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
  scrollBehavior(to, from, savedPosition) {
    // 如果是同一个活动详情页面的不同页签，保持当前滚动位置
    if (to.name?.toString().startsWith('event-detail-') && 
        from.name?.toString().startsWith('event-detail-') &&
        to.params.id === from.params.id) {
      return false // 保持当前滚动位置
    }
    
    // 如果有保存的滚动位置（浏览器前进/后退），使用保存的位置
    if (savedPosition) {
      return savedPosition
    }
    
    // 其他情况滚动到顶部
    return { top: 0 }
  },
})

// Route guard for judge workspace access control
router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next) => {
  // Check if the route is the judge workspace
  if (to.name === 'judge-workspace') {
    const store = useAppStore()
    const eventId = to.params.eventId as string

    // Ensure user is loaded
    await store.refreshUser()

    // If user is not authenticated, redirect to events
    if (!store.user) {
      return next({
        name: 'not-found',
        query: {
          message: '请先登录以访问评委界面。',
          backRoute: `/events/${eventId}`,
          backLabel: '返回活动详情'
        }
      })
    }

    // Judge permissions are now handled by Vue Query composables in the component
    // The component will handle permission checking and display appropriate UI
  }

  next()
})

// Initialize router enhancement for module loading error handling
const routerEnhancementOptions: RouterEnhancementOptions = {
  enableGlobalErrorHandling: true,
  enablePerformanceMonitoring: true,
  defaultModuleLoadOptions,
  onModuleLoadError: (error: Error, route: string) => {
    console.error(`Module loading failed for route ${route}:`, error)
    
    // Show user-friendly error message via store
    const store = useAppStore()
    store.setBanner('error', '页面加载失败，请刷新页面重试')
  },
  onPerformanceMetric: (metric) => {
    // Log performance metrics for monitoring
    if (!metric.success) {
      console.warn(`Route performance issue: ${metric.route} failed after ${metric.retryCount} retries`)
    } else if (metric.loadTime > 5000) {
      console.warn(`Slow route load: ${metric.route} took ${metric.loadTime.toFixed(2)}ms`)
    }
  }
}

// Create router enhancer instance
const routerEnhancer = new RouterEnhancer(router, routerEnhancementOptions)

// Export router enhancer for debugging and monitoring
export { routerEnhancer }

export default router
