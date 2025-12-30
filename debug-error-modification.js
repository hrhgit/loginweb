// Debug script to reproduce the error modification issue
const { ErrorHandlerAPI } = require('./src/utils/errorHandler.ts')

// Create the same type of error object as the test generator
const testError = {
  toString: () => 'Error occurred',
  name: 'TypeError'
}

console.log('Original error:', JSON.stringify(testError))
console.log('Original error name:', testError.name)

// Create error handler and process the error
const errorHandler = new ErrorHandlerAPI()
errorHandler.setThrottlingEnabled(false)
errorHandler.setDuplicateSuppressionEnabled(false)

const result = errorHandler.handleError(testError, {
  operation: 'upload',
  component: 'form'
})

console.log('After processing:')
console.log('Error name:', testError.name)
console.log('Result:', result)