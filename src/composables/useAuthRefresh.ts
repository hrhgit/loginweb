/**
 * 登录后数据刷新组合函数
 * 根据缓存管理规范，在用户登录后清除相关缓存并重新获取数据
 */

import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '../lib/vueQuery'
import { useAppStore } from '../store/appStore'
import { handleSuccessWithBanner, authErrorHandler } from '../store/enhancedErrorHandling'

/**
 * 登录后刷新内容的组合函数
 */
export function useAuthRefresh() {
  const queryClient = useQueryClient()
  const store = useAppStore()

  /**
   * 执行登录后的内容刷新
   * 根据缓存管理规范，这是"直接发起请求的情况"中的"缓存失效"场景
   */
  const refreshContentAfterLogin = async () => {
    try {
      console.log('🔄 [useAuthRefresh] Starting content refresh after login...')
      
      if (!store.user) {
        console.warn('⚠️ [useAuthRefresh] No user found, skipping refresh')
        return
      }

      const userId = store.user.id
      console.log('👤 [useAuthRefresh] Refreshing content for user:', userId)

      // 1. 清除用户相关的缓存
      console.log('🗑️ [useAuthRefresh] Invalidating user-related caches...')
      
      // 用户的活动缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.events.my(userId)
      })
      
      // 用户的注册信息缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.user.registrations(userId)
      })
      
      // 用户的队伍成员关系缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.myMemberships(userId)
      })
      
      // 用户的队伍申请缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.myRequests(userId)
      })
      
      // 用户的队伍邀请缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.myInvites(userId)
      })
      
      // 用户的通知缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.byUser(userId)
      })
      
      // 用户的个人资料缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.user.profile(userId)
      })

      // 2. 清除公共数据缓存，确保获取最新数据
      console.log('🗑️ [useAuthRefresh] Invalidating public data caches...')
      
      // 清除公开活动缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.events.public
      })
      
      // 如果是管理员，清除所有活动缓存
      if (store.isAdmin) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.events.all
        })
      }

      // 3. 清除队伍相关缓存（用户可能是队伍成员）
      console.log('👥 [useAuthRefresh] Invalidating team-related caches...')
      
      // 清除所有队伍缓存（因为用户权限可能发生变化）
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.all
      })

      // 4. 清除作品相关缓存（用户可能有提交权限）
      console.log('📝 [useAuthRefresh] Invalidating submission-related caches...')
      
      // 清除所有作品缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.submissions.all
      })

      // 5. 清除评委相关缓存（用户可能是评委）
      console.log('⚖️ [useAuthRefresh] Invalidating judge-related caches...')
      
      // 清除所有评委缓存
      await queryClient.invalidateQueries({
        queryKey: queryKeys.judges.all
      })

      console.log('✅ [useAuthRefresh] Cache invalidation completed')

      // 6. 重新加载关键数据
      console.log('📋 [useAuthRefresh] Reloading critical user data...')
      
      // 重新加载用户的注册信息
      await store.loadMyRegistrations()
      
      // 重新加载待处理的队伍操作
      await store.loadMyPendingTeamActions()

      console.log('✅ [useAuthRefresh] Content refresh after login completed successfully')
      
      // 显示成功消息
      handleSuccessWithBanner('登录成功，内容已刷新', store.setBanner, { 
        operation: 'login',
        component: 'auth' 
      })
      
    } catch (error) {
      console.error('❌ [useAuthRefresh] Failed to refresh content after login:', error)
      
      // 记录错误但不影响登录流程
      authErrorHandler.handleError(error, { 
        operation: 'refreshContentAfterLogin',
        component: 'auth',
        additionalData: {
          userId: store.user?.id
        }
      })
      
      // 显示警告消息，但不阻止用户继续使用
      store.setBanner('error', '内容刷新失败，请手动刷新页面')
    }
  }

  /**
   * 清除特定活动相关的缓存
   * 用于用户在特定活动页面登录后的精确刷新
   */
  const refreshEventContent = async (eventId: string) => {
    try {
      console.log(`🔄 [useAuthRefresh] Refreshing event content for event: ${eventId}`)
      
      if (!store.user || !eventId) return

      const userId = store.user.id

      // 清除特定活动的相关缓存
      await Promise.all([
        // 活动详情
        queryClient.invalidateQueries({
          queryKey: queryKeys.events.detail(eventId)
        }),
        
        // 活动的队伍
        queryClient.invalidateQueries({
          queryKey: queryKeys.teams.byEvent(eventId)
        }),
        
        // 活动的求组队
        queryClient.invalidateQueries({
          queryKey: queryKeys.teams.seekers(eventId)
        }),
        
        // 活动的作品
        queryClient.invalidateQueries({
          queryKey: queryKeys.submissions.byEvent(eventId)
        }),
        
        // 活动的报名表
        queryClient.invalidateQueries({
          queryKey: queryKeys.registrations.form(eventId, userId)
        }),
        
        // 活动的报名统计
        queryClient.invalidateQueries({
          queryKey: queryKeys.registrations.count(eventId)
        }),
        
        // 活动的评委
        queryClient.invalidateQueries({
          queryKey: queryKeys.judges.byEvent(eventId)
        }),
        
        // 用户在该活动的评委权限
        queryClient.invalidateQueries({
          queryKey: queryKeys.judges.permissions(eventId, userId)
        })
      ])

      console.log(`✅ [useAuthRefresh] Event content refresh completed for event: ${eventId}`)
      
    } catch (error) {
      console.error(`❌ [useAuthRefresh] Failed to refresh event content for event: ${eventId}`, error)
      
      authErrorHandler.handleError(error, { 
        operation: 'refreshEventContent',
        component: 'auth',
        additionalData: {
          eventId,
          userId: store.user?.id
        }
      })
    }
  }

  /**
   * 强制刷新所有缓存
   * 用于需要完全重新加载数据的场景
   */
  const forceRefreshAll = async () => {
    try {
      console.log('🔄 [useAuthRefresh] Force refreshing all caches...')
      
      // 清除所有查询缓存
      await queryClient.invalidateQueries()
      
      // 重新加载关键数据
      if (store.user) {
        await Promise.all([
          store.loadMyRegistrations(),
          store.loadMyPendingTeamActions()
        ])
      }
      
      console.log('✅ [useAuthRefresh] Force refresh completed')
      
      handleSuccessWithBanner('所有内容已刷新', store.setBanner, { 
        operation: 'forceRefresh',
        component: 'auth' 
      })
      
    } catch (error) {
      console.error('❌ [useAuthRefresh] Failed to force refresh all caches:', error)
      
      authErrorHandler.handleError(error, { 
        operation: 'forceRefreshAll',
        component: 'auth'
      })
      
      store.setBanner('error', '刷新失败，请重新加载页面')
    }
  }

  return {
    refreshContentAfterLogin,
    refreshEventContent,
    forceRefreshAll
  }
}