// Test script to debug Area Code extraction for outgoing calls
const MongoCombinedCallLogsService = require('./services/mongoCombinedCallLogsService.cjs');

async function testAreaCodeExtraction() {
  const service = new MongoCombinedCallLogsService();
  
  console.log('========== TESTING AREA CODE EXTRACTION ==========');
  console.log('Testing with Caller ID: 949548010711');
  console.log('');
  
  // Test the extractAreaCode method directly
  const testNumber = '949548010711';
  
  console.log('1. Testing extractAreaCode() method for OUTGOING calls:');
  console.log('   Input: ' + testNumber);
  
  // Remove non-digits (none in this case)
  const digits = testNumber.replace(/\D/g, '');
  console.log('   After removing non-digits: ' + digits);
  console.log('   Length: ' + digits.length);
  
  // Check the conditions in the method
  console.log('');
  console.log('2. Checking conditions in extractAreaCode():');
  console.log('   Does it start with "1"? ' + digits.startsWith('1'));
  console.log('   Length >= 5? ' + (digits.length >= 5));
  
  if (digits.startsWith('1')) {
    console.log('   → Would use substring(3, 6) for digits starting with "1"');
    console.log('   → substring(3, 6) of "' + digits + '" = "' + digits.substring(3, 6) + '"');
    console.log('   → This gives us positions 3,4,5 (0-based) = "' + digits.substring(3, 6) + '"');
  } else {
    console.log('   → Would use substring(2, 5) for digits NOT starting with "1"');
    console.log('   → substring(2, 5) of "' + digits + '" = "' + digits.substring(2, 5) + '"');
    console.log('   → This gives us positions 2,3,4 (0-based) = "' + digits.substring(2, 5) + '"');
  }
  
  console.log('');
  console.log('3. Actual method result:');
  const areaCode = service.extractAreaCode(testNumber, 'Outgoing');
  console.log('   Area Code extracted: "' + areaCode + '"');
  
  console.log('');
  console.log('4. Expected vs Actual:');
  console.log('   Company Code (first 2 digits): Expected "94", Got "' + service.extractCompanyCode(testNumber, 'Outgoing') + '"');
  console.log('   Area Code (digits 3-5): Expected "954", Got "' + areaCode + '"');
  
  console.log('');
  console.log('========== PROBLEM IDENTIFIED ==========');
  console.log('The issue is in line 58-59 of mongoCombinedCallLogsService.cjs:');
  console.log('');
  console.log('Current code (WRONG):');
  console.log('  if (digits.startsWith("1")) {');
  console.log('    return digits.substring(3, 6); // This assumes "1" is a country code');
  console.log('  }');
  console.log('');
  console.log('The problem: The number "949548010711" starts with "9", not "1".');
  console.log('But even if it did start with "1", the logic is wrong for this use case.');
  console.log('');
  console.log('For outgoing calls with format like "949548010711":');
  console.log('  - Positions 0-1: Company Code = "94"');
  console.log('  - Positions 2-4: Area Code = "954"');
  console.log('  - Remaining: Phone number = "8010711"');
  console.log('');
  console.log('The condition checking for startsWith("1") is incorrect for this format.');
  console.log('It should ALWAYS use substring(2, 5) for outgoing calls in this format.');
  
  console.log('');
  console.log('========== MONGODB AGGREGATION CHECK ==========');
  console.log('Checking MongoDB aggregation pipeline (lines 403-428):');
  console.log('The MongoDB pipeline has the SAME ISSUE:');
  console.log('  Line 413: { $eq: [{ $substr: ["$$digits.match", 0, 1] }, "1"] }');
  console.log('  Line 415: then: { $substr: ["$$digits.match", 3, 3] }');
  console.log('');
  console.log('This checks if first digit is "1" and then takes positions 3-5,');
  console.log('which is wrong for the format "949548010711".');
  
  await service.close();
}

testAreaCodeExtraction().catch(console.error);