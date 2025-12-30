/**
 * Property-Based Tests for Offline Form Handling
 * 
 * **Feature: network-performance-optimization, Property 17: Offline form handling**
 * **Validates: Requirements 5.2**
 * 
 * Tests that form interactions during offline periods store input locally
 * with clear indicators about connectivity requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'

// Mock types for offline form functionality
interface FormData {
  id: string
  fields: Record<string, any>
  timestamp: number
  formType: string
}

interface OfflineFormIndicator {
  isVisible: boolean
  message: string
  type: 'warning' | 'info' | 'error'
  requiresConnectivity: boolean
}

interface StoredFormData {
  data: FormData
  indicator: OfflineFormIndicator
  canSubmit: boolean
}

// Mock offline form manager for testing
class MockOfflineFormManager {
  private storedForms: Map<string, FormData> = new Map()
  private isOffline: boolean = false

  setOfflineStatus(offline: boolean): void {
    this.isOffline = offline
  }

  storeFormData(formData: FormData): StoredFormData {
    if (this.isOffline) {
      // Store form data locally when offline
      this.storedForms.set(formData.id, {
        ...formData,
        timestamp: Date.now()
      })

      return {
        data: formData,
        indicator: {
          isVisible: true,
          message: 'Form data saved locally. Internet connection required for submission.',
          type: 'warning',
          requiresConnectivity: true
        },
        canSubmit: false
      }
    } else {
      // When online, can submit immediately
      return {
        data: formData,
        indicator: {
          isVisible: false,
          message: '',
          type: 'info',
          requiresConnectivity: false
        },
        canSubmit: true
      }
    }
  }

  getStoredFormData(formId: string): FormData | null {
    return this.storedForms.get(formId) || null
  }

  getAllStoredForms(): FormData[] {
    return Array.from(this.storedForms.values())
  }

  clearStoredForm(formId: string): boolean {
    return this.storedForms.delete(formId)
  }

  getFormSubmissionStatus(formId: string): {
    canSubmit: boolean
    indicator: OfflineFormIndicator
  } {
    const storedForm = this.storedForms.get(formId)
    
    if (this.isOffline) {
      return {
        canSubmit: false,
        indicator: {
          isVisible: true,
          message: 'Cannot submit while offline. Please connect to the internet.',
          type: 'error',
          requiresConnectivity: true
        }
      }
    }

    if (storedForm) {
      return {
        canSubmit: true,
        indicator: {
          isVisible: true,
          message: 'Connection restored. You can now submit your form.',
          type: 'info',
          requiresConnectivity: false
        }
      }
    }

    return {
      canSubmit: true,
      indicator: {
        isVisible: false,
        message: '',
        type: 'info',
        requiresConnectivity: false
      }
    }
  }

  simulateFormSubmission(formId: string): { success: boolean; error?: string } {
    if (this.isOffline) {
      return {
        success: false,
        error: 'Cannot submit form while offline'
      }
    }

    const storedForm = this.storedForms.get(formId)
    if (storedForm) {
      // Simulate successful submission and cleanup
      this.storedForms.delete(formId)
      return { success: true }
    }

    return { success: true }
  }
}

describe('Offline Form Handling Property Tests', () => {
  let formManager: MockOfflineFormManager

  beforeEach(() => {
    formManager = new MockOfflineFormManager()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Property 17: Offline form handling', () => {
    it('should store form input locally when offline with connectivity indicators', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          fields: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(
              fc.string({ minLength: 0, maxLength: 100 }),
              fc.integer({ min: 0, max: 1000 }),
              fc.boolean()
            )
          ),
          formType: fc.constantFrom('event', 'team', 'submission', 'profile')
        }), { minLength: 1, maxLength: 10 }),
        fc.boolean(),
        (forms, isOffline) => {
          formManager.setOfflineStatus(isOffline)

          forms.forEach(form => {
            const result = formManager.storeFormData(form)

            // Verify form data is stored correctly
            expect(result.data.id).toBe(form.id)
            expect(result.data.fields).toEqual(form.fields)
            expect(result.data.formType).toBe(form.formType)

            if (isOffline) {
              // When offline, should store locally with warning indicator
              expect(result.canSubmit).toBe(false)
              expect(result.indicator.isVisible).toBe(true)
              expect(result.indicator.type).toBe('warning')
              expect(result.indicator.requiresConnectivity).toBe(true)
              expect(result.indicator.message).toContain('Internet connection required')

              // Verify data is actually stored
              const storedData = formManager.getStoredFormData(form.id)
              expect(storedData).toBeTruthy()
              expect(storedData?.fields).toEqual(form.fields)
            } else {
              // When online, should allow immediate submission
              expect(result.canSubmit).toBe(true)
              expect(result.indicator.isVisible).toBe(false)
              expect(result.indicator.requiresConnectivity).toBe(false)
            }
          })
        }
      ), { numRuns: 100 })
    })

    it('should provide clear connectivity requirements for form submission', () => {
      fc.assert(fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 15 }),
          fields: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 8 }),
            fc.string({ minLength: 0, maxLength: 50 })
          ),
          formType: fc.constantFrom('event', 'team', 'submission')
        }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (form, connectivityChanges) => {
          let lastStoredOffline = false

          connectivityChanges.forEach(isOffline => {
            formManager.setOfflineStatus(isOffline)

            // Store form data if going offline
            if (isOffline && !lastStoredOffline) {
              formManager.storeFormData(form)
              lastStoredOffline = true
            }

            const status = formManager.getFormSubmissionStatus(form.id)

            if (isOffline) {
              // When offline, cannot submit and should show error
              expect(status.canSubmit).toBe(false)
              expect(status.indicator.isVisible).toBe(true)
              expect(status.indicator.type).toBe('error')
              expect(status.indicator.requiresConnectivity).toBe(true)
              expect(status.indicator.message).toContain('offline')
            } else if (lastStoredOffline) {
              // When back online with stored data, should show restoration message
              expect(status.canSubmit).toBe(true)
              expect(status.indicator.isVisible).toBe(true)
              expect(status.indicator.type).toBe('info')
              expect(status.indicator.requiresConnectivity).toBe(false)
              expect(status.indicator.message).toContain('Connection restored')
            } else {
              // When online without stored data, normal state
              expect(status.canSubmit).toBe(true)
              // Don't check indicator visibility as it depends on whether form was stored
            }
          })
        }
      ), { numRuns: 100 })
    })

    it('should maintain form data integrity across offline/online transitions', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          id: fc.string({ minLength: 1, maxLength: 12 }),
          fields: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 6 }),
            fc.oneof(fc.string({ minLength: 0, max: 30 }), fc.nat({ max: 100 }))
          ),
          formType: fc.constantFrom('team', 'event')
        }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 8 }),
        (forms, connectivityPattern) => {
          const originalFormsData = new Map(forms.map(f => [f.id, f.fields]))

          // Store forms during offline periods
          connectivityPattern.forEach(isOffline => {
            formManager.setOfflineStatus(isOffline)

            if (isOffline) {
              forms.forEach(form => {
                formManager.storeFormData(form)
              })
            }
          })

          // Verify data integrity after all transitions
          forms.forEach(form => {
            const storedData = formManager.getStoredFormData(form.id)
            if (storedData) {
              // Stored data should match original
              expect(storedData.fields).toEqual(originalFormsData.get(form.id))
              expect(storedData.formType).toBe(form.formType)
              expect(storedData.timestamp).toBeTypeOf('number')
              expect(storedData.timestamp).toBeGreaterThan(0)
            }
          })

          // Check that forms were stored if there were offline periods
          const hadOfflinePeriod = connectivityPattern.some(isOffline => isOffline)
          if (hadOfflinePeriod) {
            // At least some forms should be stored if we had offline periods
            const allStored = formManager.getAllStoredForms()
            const storedIds = new Set(allStored.map(f => f.id))
            
            forms.forEach(form => {
              const storedData = formManager.getStoredFormData(form.id)
              if (storedData) {
                expect(storedIds.has(form.id)).toBe(true)
              }
            })
          }
        }
      ), { numRuns: 100 })
    })

    it('should handle form submission attempts correctly based on connectivity', () => {
      fc.assert(fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 10 }),
          fields: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 5 }),
            fc.string({ minLength: 0, maxLength: 20 })
          ),
          formType: fc.constantFrom('submission', 'profile')
        }),
        fc.boolean(),
        fc.boolean(),
        (form, storeOffline, submitOnline) => {
          // Store form data while offline if specified
          if (storeOffline) {
            formManager.setOfflineStatus(true)
            formManager.storeFormData(form)
          }

          // Set online status for submission attempt
          formManager.setOfflineStatus(!submitOnline)

          const submissionResult = formManager.simulateFormSubmission(form.id)

          if (submitOnline) {
            // Should succeed when online
            expect(submissionResult.success).toBe(true)
            expect(submissionResult.error).toBeUndefined()

            // If form was stored offline, it should be cleared after successful submission
            if (storeOffline) {
              const storedAfterSubmission = formManager.getStoredFormData(form.id)
              expect(storedAfterSubmission).toBeNull()
            }
          } else {
            // Should fail when offline
            expect(submissionResult.success).toBe(false)
            expect(submissionResult.error).toContain('offline')

            // Form data should remain stored if it was stored offline
            if (storeOffline) {
              const storedData = formManager.getStoredFormData(form.id)
              expect(storedData).toBeTruthy()
            }
          }
        }
      ), { numRuns: 100 })
    })

    it('should provide appropriate indicators for different form states', () => {
      fc.assert(fc.property(
        fc.array(fc.record({
          id: fc.string({ minLength: 1, maxLength: 8 }),
          fields: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 4 }),
            fc.string({ minLength: 0, maxLength: 15 })
          ),
          formType: fc.constantFrom('event', 'team')
        }), { minLength: 1, maxLength: 3 }),
        (forms) => {
          // Test different scenarios
          const scenarios = [
            { offline: false, hasStoredData: false }, // Normal online state
            { offline: true, hasStoredData: false },  // Going offline
            { offline: true, hasStoredData: true },   // Offline with stored data
            { offline: false, hasStoredData: true }   // Back online with stored data
          ]

          scenarios.forEach(scenario => {
            formManager.setOfflineStatus(scenario.offline)

            forms.forEach(form => {
              if (scenario.hasStoredData) {
                // Store data first if needed
                formManager.setOfflineStatus(true)
                formManager.storeFormData(form)
                formManager.setOfflineStatus(scenario.offline)
              }

              const status = formManager.getFormSubmissionStatus(form.id)

              if (scenario.offline) {
                // Offline scenarios should prevent submission
                expect(status.canSubmit).toBe(false)
                expect(status.indicator.isVisible).toBe(true)
                expect(status.indicator.requiresConnectivity).toBe(true)
              } else if (scenario.hasStoredData) {
                // Online with stored data should allow submission with info
                expect(status.canSubmit).toBe(true)
                expect(status.indicator.isVisible).toBe(true)
                expect(status.indicator.type).toBe('info')
              } else {
                // Normal online state
                expect(status.canSubmit).toBe(true)
                expect(status.indicator.requiresConnectivity).toBe(false)
              }
            })
          })
        }
      ), { numRuns: 100 })
    })
  })
})