/**
 * Main entry point for Bifrost tests
 * This file imports and runs all the Bifrost tests
 */

// Import the shared mock setup
import { setupBuffMock } from '../__mocks__/buff.mock';
setupBuffMock();

// Import individual test files
import './generateKeysetWithSecret.test';
import './decode_share.test';
import './decode_group.test';
import './recover_nsec.test';

// No tests here - all tests are in the imported files
describe('Bifrost Module', () => {
  it('should have all components properly tested', () => {
    // This is just a placeholder test
    expect(true).toBe(true);
  });
}); 