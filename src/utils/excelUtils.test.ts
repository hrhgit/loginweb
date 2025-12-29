/**
 * Tests for Excel utility functions
 */

import { describe, it, expect } from 'vitest'
import {
  generateExportPreview,
  formatPreviewForDisplay
} from './excelUtils'
import type { FlattenedRegistration } from './exportUtils'

describe('Excel Export Preview', () => {
  it('should generate preview for empty data', () => {
    const preview = generateExportPreview([])
    
    expect(preview.totalRegistrations).toBe(0)
    expect(preview.detectedColumns).toEqual(['用户ID', '用户名', '报名状态', '报名时间'])
    expect(preview.sampleData).toEqual([])
    expect(preview.hasComplexData).toBe(false)
    expect(preview.columnCount).toBe(4)
  })
  
  it('should generate preview with sample data', () => {
    const data: FlattenedRegistration[] = [
      {
        用户ID: 'user1',
        用户名: 'John Doe',
        报名状态: '已确认',
        报名时间: '2023-01-01 10:00:00',
        name: 'John',
        'skills.programming': 'JavaScript'
      },
      {
        用户ID: 'user2',
        用户名: 'Jane Smith',
        报名状态: '已确认',
        报名时间: '2023-01-02 11:00:00',
        name: 'Jane',
        experience: '5 years'
      }
    ]
    
    const preview = generateExportPreview(data, 1)
    
    expect(preview.totalRegistrations).toBe(2)
    expect(preview.detectedColumns).toContain('用户ID')
    expect(preview.detectedColumns).toContain('name')
    expect(preview.detectedColumns).toContain('skills.programming')
    expect(preview.detectedColumns).toContain('experience')
    expect(preview.sampleData).toHaveLength(1)
    expect(preview.hasComplexData).toBe(true) // Due to 'skills.programming'
    expect(preview.columnCount).toBeGreaterThan(4)
  })
  
  it('should order columns with standard columns first', () => {
    const data: FlattenedRegistration[] = [
      {
        用户ID: 'user1',
        用户名: 'John',
        报名状态: '已确认',
        报名时间: '2023-01-01',
        zzz_last: 'should be last',
        aaa_first: 'should be after standard'
      }
    ]
    
    const preview = generateExportPreview(data)
    const columns = preview.detectedColumns
    
    expect(columns[0]).toBe('用户ID')
    expect(columns[1]).toBe('用户名')
    expect(columns[2]).toBe('报名状态')
    expect(columns[3]).toBe('报名时间')
    expect(columns.indexOf('aaa_first')).toBeLessThan(columns.indexOf('zzz_last'))
  })
})

describe('Preview Display Formatting', () => {
  it('should format preview for display', () => {
    const preview = {
      totalRegistrations: 10,
      detectedColumns: ['用户ID', '用户名', '报名状态', '报名时间', 'custom_field'],
      sampleData: [
        {
          用户ID: 'user1',
          用户名: 'John Doe',
          报名状态: '已确认',
          报名时间: '2023-01-01',
          custom_field: 'Some very long text that should be truncated for display purposes'
        }
      ] as FlattenedRegistration[],
      hasComplexData: false,
      columnCount: 5
    }
    
    const formatted = formatPreviewForDisplay(preview)
    
    expect(formatted.summary).toContain('共 10 条报名记录')
    expect(formatted.summary).toContain('检测到 5 个数据列')
    expect(formatted.columnList).toContain('用户ID（标准列）')
    expect(formatted.columnList).toContain('custom_field（表单数据）')
    expect(formatted.sampleRows[0].custom_field).toContain('...')
  })
  
  it('should indicate complex data in summary', () => {
    const preview = {
      totalRegistrations: 5,
      detectedColumns: ['用户ID', '用户名', 'nested.field'],
      sampleData: [],
      hasComplexData: true,
      columnCount: 3
    }
    
    const formatted = formatPreviewForDisplay(preview)
    
    expect(formatted.summary).toContain('（包含复杂表单数据）')
  })
})