/**
 * Excel generation utilities for registration data export
 * Uses the XLSX library for Excel file creation
 */

import * as XLSX from 'xlsx'
import type { FlattenedRegistration } from './exportUtils'

// ============================================================
// Excel Generation Utilities
// ============================================================

export interface ExcelExportOptions {
  sheetName?: string
  filename?: string
  includeHeaders?: boolean
  autoWidth?: boolean
}

/**
 * Creates an Excel workbook from flattened registration data
 */
export const createRegistrationWorkbook = (
  data: FlattenedRegistration[],
  options: ExcelExportOptions = {}
): XLSX.WorkBook => {
  const {
    sheetName = '报名数据',
    includeHeaders = true,
    autoWidth = true
  } = options
  
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()
  
  if (data.length === 0) {
    // Create empty worksheet with headers only
    const emptyData = [{
      用户ID: '',
      用户名: '',
      报名状态: '',
      报名时间: ''
    }]
    const worksheet = XLSX.utils.json_to_sheet(emptyData, { header: Object.keys(emptyData[0]) })
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    return workbook
  }
  
  // Get all unique columns from the data
  const allColumns = new Set<string>()
  data.forEach(row => {
    Object.keys(row).forEach(key => allColumns.add(key))
  })
  
  // Ensure standard columns come first
  const standardColumns = ['用户ID', '用户名', '报名状态', '报名时间']
  const dynamicColumns = Array.from(allColumns).filter(col => !standardColumns.includes(col))
  const orderedColumns = [...standardColumns, ...dynamicColumns.sort()]
  
  // Create worksheet with ordered columns
  const worksheet = XLSX.utils.json_to_sheet(data, { 
    header: orderedColumns,
    skipHeader: !includeHeaders 
  })
  
  // Auto-size columns if requested
  if (autoWidth) {
    const columnWidths = calculateColumnWidths(data, orderedColumns)
    worksheet['!cols'] = columnWidths
  }
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  return workbook
}

/**
 * Calculates optimal column widths based on content
 */
const calculateColumnWidths = (
  data: FlattenedRegistration[],
  columns: string[]
): XLSX.ColInfo[] => {
  return columns.map(column => {
    // Start with header width
    let maxWidth = column.length
    
    // Check data content width
    data.forEach(row => {
      const cellValue = String(row[column] || '')
      maxWidth = Math.max(maxWidth, cellValue.length)
    })
    
    // Set reasonable limits
    const width = Math.min(Math.max(maxWidth + 2, 10), 50)
    
    return { width }
  })
}

/**
 * Exports Excel workbook as file download
 */
export const downloadExcelFile = (
  workbook: XLSX.WorkBook,
  filename: string
): void => {
  try {
    // Use XLSX.writeFile for direct browser download
    XLSX.writeFile(workbook, filename)
  } catch (error) {
    console.error('Failed to download Excel file:', error)
    throw new Error(`导出Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * Creates and downloads registration Excel export
 */
export const exportRegistrationsToExcel = (
  data: FlattenedRegistration[],
  filename: string,
  options: ExcelExportOptions = {}
): void => {
  try {
    const workbook = createRegistrationWorkbook(data, options)
    downloadExcelFile(workbook, filename)
  } catch (error) {
    console.error('Failed to export registrations to Excel:', error)
    throw error
  }
}

// ============================================================
// Preview Generation Utilities
// ============================================================

export interface ExportPreview {
  totalRegistrations: number
  detectedColumns: string[]
  sampleData: FlattenedRegistration[]
  hasComplexData: boolean
  columnCount: number
}

/**
 * Generates a preview of what the Excel export will contain
 */
export const generateExportPreview = (
  data: FlattenedRegistration[],
  maxSampleSize = 5
): ExportPreview => {
  if (data.length === 0) {
    return {
      totalRegistrations: 0,
      detectedColumns: ['用户ID', '用户名', '报名状态', '报名时间'],
      sampleData: [],
      hasComplexData: false,
      columnCount: 4
    }
  }
  
  // Get all unique columns
  const allColumns = new Set<string>()
  let hasComplexData = false
  
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      allColumns.add(key)
      // Check if we have complex nested data (indicated by dots in keys)
      if (key.includes('.') || key.includes(' - ')) {
        hasComplexData = true
      }
    })
  })
  
  const detectedColumns = Array.from(allColumns)
  
  // Ensure standard columns come first in preview
  const standardColumns = ['用户ID', '用户名', '报名状态', '报名时间']
  const dynamicColumns = detectedColumns.filter(col => !standardColumns.includes(col))
  const orderedColumns = [...standardColumns, ...dynamicColumns.sort()]
  
  // Get sample data (first N records)
  const sampleData = data.slice(0, maxSampleSize)
  
  return {
    totalRegistrations: data.length,
    detectedColumns: orderedColumns,
    sampleData,
    hasComplexData,
    columnCount: orderedColumns.length
  }
}

/**
 * Formats preview data for display in UI
 */
export const formatPreviewForDisplay = (preview: ExportPreview): {
  summary: string
  columnList: string[]
  sampleRows: Array<Record<string, string>>
} => {
  const { totalRegistrations, detectedColumns, sampleData, hasComplexData } = preview
  
  // Create summary text
  let summary = `共 ${totalRegistrations} 条报名记录，检测到 ${detectedColumns.length} 个数据列`
  
  if (hasComplexData) {
    summary += '（包含复杂表单数据）'
  }
  
  // Format column list for display
  const columnList = detectedColumns.map(col => {
    if (['用户ID', '用户名', '报名状态', '报名时间'].includes(col)) {
      return `${col}（标准列）`
    }
    return `${col}（表单数据）`
  })
  
  // Format sample rows for display (limit column content length)
  const sampleRows = sampleData.map(row => {
    const formattedRow: Record<string, string> = {}
    detectedColumns.forEach(col => {
      const value = String(row[col] || '')
      // Truncate long values for preview
      formattedRow[col] = value.length > 50 ? `${value.substring(0, 47)}...` : value
    })
    return formattedRow
  })
  
  return {
    summary,
    columnList,
    sampleRows
  }
}