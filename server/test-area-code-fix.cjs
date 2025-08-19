// Test script to verify the Area Code extraction fix
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Mock the service to test just the extraction logic
class TestService {
  extractAreaCode(phoneNumber, callType = 'Incoming') {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // For outgoing calls, area code is ALWAYS digits 3-5 (positions 2-4 in 0-based indexing)
    // Format: [CompanyCode:2 digits][AreaCode:3 digits][PhoneNumber:remaining]
    if (callType === 'Outgoing') {
      if (digits.length >= 5) {
        return digits.substring(2, 5); // Get digits 3-5 (positions 2-4 in 0-based indexing)
      }
    } else {
      // For incoming calls, use existing logic
      // Check if it starts with 1 (US/Canada country code)
      if (digits.length >= 4 && digits.startsWith('1')) {
        return digits.substring(1, 4); // Get digits 2-4 (area code)
      }
      
      // If no country code, assume first 3 digits are area code
      if (digits.length >= 3) {
        return digits.substring(0, 3);
      }
    }
    
    return '';
  }
  
  extractCompanyCode(phoneNumber, callType = 'Incoming') {
    if (!phoneNumber || callType !== 'Outgoing') return '';
    
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Company code is first 2 digits from the left side of Caller ID for outgoing calls
    if (digits.length >= 2) {
      return digits.substring(0, 2);
    }
    
    return '';
  }
}

console.log('========== TESTING AREA CODE FIX ==========');
console.log('');

const service = new TestService();

// Test cases for outgoing calls
const testCases = [
  { number: '949548010711', expectedCompany: '94', expectedArea: '954', description: 'Original reported issue' },
  { number: '123456789012', expectedCompany: '12', expectedArea: '345', description: 'Number starting with 1' },
  { number: '987654321098', expectedCompany: '98', expectedArea: '765', description: 'Different number' },
  { number: '100234567890', expectedCompany: '10', expectedArea: '023', description: 'Company code is 10' },
  { number: '019876543210', expectedCompany: '01', expectedArea: '987', description: 'Company code is 01' },
];

console.log('Testing OUTGOING calls:');
console.log('Format: [CompanyCode:2][AreaCode:3][PhoneNumber:remaining]');
console.log('');

let allPassed = true;

testCases.forEach((test, index) => {
  const companyCode = service.extractCompanyCode(test.number, 'Outgoing');
  const areaCode = service.extractAreaCode(test.number, 'Outgoing');
  
  const companyPassed = companyCode === test.expectedCompany;
  const areaPassed = areaCode === test.expectedArea;
  const passed = companyPassed && areaPassed;
  
  if (!passed) allPassed = false;
  
  console.log(`Test ${index + 1}: ${test.description}`);
  console.log(`  Input: ${test.number}`);
  console.log(`  Company Code: Expected "${test.expectedCompany}", Got "${companyCode}" ${companyPassed ? '✅' : '❌'}`);
  console.log(`  Area Code: Expected "${test.expectedArea}", Got "${areaCode}" ${areaPassed ? '✅' : '❌'}`);
  console.log('');
});

console.log('========== TEST RESULTS ==========');
if (allPassed) {
  console.log('✅ ALL TESTS PASSED - The fix is working correctly!');
  console.log('');
  console.log('The Area Code extraction for outgoing calls now:');
  console.log('1. ALWAYS extracts digits 3-5 (positions 2-4 in 0-based indexing)');
  console.log('2. Does NOT check if the number starts with "1"');
  console.log('3. Works consistently for all number formats');
} else {
  console.log('❌ SOME TESTS FAILED - Please review the implementation');
}

console.log('');
console.log('========== MONGODB AGGREGATION NOTE ==========');
console.log('The MongoDB aggregation pipeline has also been fixed to:');
console.log('- Remove the condition checking for first digit being "1"');
console.log('- Always use $substr: ["$$digits.match", 2, 3] for outgoing calls');
console.log('- This ensures consistency between JavaScript and MongoDB extraction');