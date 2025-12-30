// Minimal test to reproduce error modification issue
import { ErrorHandlerAPI } from './src/utils/errorHandler.ts'

// Create the same type of error object as the failing test
const originalError = {
  toString: () => 'Error occurred',
  name: 'ReferenceError'
}

console.log('Before handleError:')
console.log('Error name:', originalError.name)
console.log('Error toString:', originalError.toString())

// Create error handler
const errorHandler = new ErrorHandlerAPI()
errorHandler.setThrottlingEnabled(false)
errorHandler.setDuplicateSuppressionEnabled(false)

// Process the error
const result = errorHandler.handleError(originalError, {
  operation: 'upload',
  component: 'form'
})

console.log('After handleError:')
console.log('Error name:', originalError.name)
console.log('Result type:', result.type)
console.log('Result:', result)