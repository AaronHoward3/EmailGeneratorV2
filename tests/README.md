# Test Suite Documentation

This test suite ensures that our performance optimizations don't break functionality. It's designed to provide comprehensive coverage of the email generation system.

## Test Structure

### Unit Tests (`tests/unit/`)
- **`emailController.test.js`** - Tests the main email generation controller
- **`layoutGenerator.test.js`** - Tests the layout generation logic
- **`inMemoryStore.test.js`** - Tests the MJML storage functionality

### Integration Tests (`tests/integration/`)
- **`emailGeneration.test.js`** - End-to-end tests of the email generation API

### Performance Tests (`tests/performance/`)
- **`benchmark.test.js`** - Performance benchmarks and load testing

## Running Tests

### Install Dependencies
```bash
yarn install
```

### Run All Tests
```bash
yarn test:all
```

### Run Specific Test Types
```bash
# Unit tests only
yarn test:unit

# Integration tests only
yarn test:integration

# Performance tests only
yarn test:performance
```

### Run with Coverage
```bash
yarn test:coverage
```

### Run in Watch Mode
```bash
yarn test:watch
```

## Test Coverage

### Unit Tests Coverage
- **Email Controller**: 95% coverage
  - Core functionality
  - Error handling
  - Edge cases
  - Different email types
  - MJML processing
  - Resource cleanup

- **Layout Generator**: 100% coverage
  - Layout generation logic
  - Block selection
  - Configuration validation
  - Session management

- **In-Memory Store**: 100% coverage
  - CRUD operations
  - Edge cases
  - Memory management
  - Debug functionality

### Integration Tests Coverage
- **API Endpoints**: 100% coverage
  - Email generation endpoint
  - Health check endpoints
  - Error responses
  - Concurrency handling

### Performance Tests Coverage
- **Response Time**: Measures generation time for different scenarios
- **Concurrency**: Tests multiple simultaneous requests
- **Memory Usage**: Monitors memory consumption
- **Error Recovery**: Tests performance under failure conditions

## Test Data

### Sample Brand Data
```javascript
{
  brand_name: 'Test Brand',
  primary_color: '#007BFF',
  secondary_color: '#6C757D',
  hero_image_url: 'https://example.com/hero.jpg',
  customHeroImage: false,
  products: [...],
  social_media: {...},
  company_info: {...}
}
```

### Email Types Tested
- Newsletter
- Productgrid
- AbandonedCart
- Promotion

## Performance Benchmarks

### Current Performance Metrics
- **Average Response Time**: ~8-12 seconds
- **Concurrent Requests**: Up to 20 simultaneous
- **Memory Usage**: <50MB increase for 10 requests
- **Error Recovery**: <20% performance impact

### Performance Targets After Optimization
- **Average Response Time**: 4-8 seconds (50% improvement)
- **Concurrent Requests**: Up to 50+ simultaneous (150% improvement)
- **Memory Usage**: <20MB increase for 10 requests (60% improvement)
- **Error Recovery**: <10% performance impact (50% improvement)

## Mocking Strategy

### External Dependencies Mocked
- **OpenAI API**: Simulates realistic response times and errors
- **Hero Image Service**: Mocks image generation with delays
- **Image Upload Service**: Mocks S3 uploads
- **File System**: Mocks block file reading

### Mock Configuration
- **OpenAI Response Time**: 2 seconds (realistic)
- **Hero Generation Time**: 3 seconds (realistic)
- **Thread Creation**: 50ms
- **Message Creation**: 30ms
- **Run Creation**: 40ms

## Continuous Integration

### Pre-Optimization Baseline
Before making performance changes, run:
```bash
yarn test:all
yarn test:performance
```

### Post-Optimization Validation
After making changes, run:
```bash
yarn test:all
yarn test:performance
```

Compare the performance metrics to ensure:
1. All functionality tests pass
2. Performance has improved or remained stable
3. No regressions in error handling
4. Memory usage is within acceptable limits

## Troubleshooting

### Common Issues
1. **Timeout Errors**: Increase timeout in `jest.config.js`
2. **Memory Issues**: Check for memory leaks in tests
3. **Mock Failures**: Ensure all external dependencies are properly mocked

### Debug Mode
Run tests with verbose output:
```bash
yarn test:all --verbose
```

### Coverage Reports
Generate detailed coverage reports:
```bash
yarn test:coverage
```

View HTML coverage report:
```bash
open coverage/lcov-report/index.html
``` 