// Test script to verify Area Code extraction with live data
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MongoCombinedCallLogsService = require('./services/mongoCombinedCallLogsService.cjs');

async function testLiveAreaCode() {
  const service = new MongoCombinedCallLogsService();
  
  try {
    await service.init();
    
    console.log('========== TESTING LIVE AREA CODE EXTRACTION ==========');
    console.log('');
    console.log('Fetching outgoing calls to verify Area Code extraction...');
    console.log('');
    
    // Get some outgoing calls
    const result = await service.getCombinedCallLogs({
      page: 1,
      pageSize: 10,
      CallType: 'Outgoing',
      sortBy: 'CallTime',
      sortOrder: 'DESC'
    });
    
    console.log(`Found ${result.outgoingCount} total outgoing calls`);
    console.log(`Displaying first ${result.data.length} records:`);
    console.log('');
    console.log('Format: [CompanyCode:2][AreaCode:3][PhoneNumber:remaining]');
    console.log('');
    
    // Check each record
    result.data.forEach((record, index) => {
      const callerID = record.CallerID || '';
      const companyCode = record.CompanyCode || '';
      const areaCode = record.AreaCode || '';
      
      // Extract what the area code should be
      const digits = callerID.replace(/\D/g, '');
      const expectedCompany = digits.length >= 2 ? digits.substring(0, 2) : '';
      const expectedArea = digits.length >= 5 ? digits.substring(2, 5) : '';
      
      const companyMatch = companyCode === expectedCompany;
      const areaMatch = areaCode === expectedArea;
      
      console.log(`Record ${index + 1}:`);
      console.log(`  Caller ID: ${callerID}`);
      console.log(`  Company Code: "${companyCode}" (Expected: "${expectedCompany}") ${companyMatch ? '✅' : '❌'}`);
      console.log(`  Area Code: "${areaCode}" (Expected: "${expectedArea}") ${areaMatch ? '✅' : '❌'}`);
      
      // Special check for the reported issue
      if (callerID === '949548010711') {
        console.log(`  ⚠️  THIS IS THE REPORTED ISSUE NUMBER`);
        if (areaCode === '954') {
          console.log(`  ✅ ISSUE FIXED: Area Code is now correctly showing "954"`);
        } else {
          console.log(`  ❌ ISSUE NOT FIXED: Area Code is still showing "${areaCode}" instead of "954"`);
        }
      }
      
      console.log('');
    });
    
    // Look specifically for the reported number
    console.log('========== SEARCHING FOR REPORTED NUMBER ==========');
    const specificResult = await service.getCombinedCallLogs({
      page: 1,
      pageSize: 100,
      CallType: 'Outgoing',
      search: '949548010711'
    });
    
    const foundRecord = specificResult.data.find(r => r.CallerID === '949548010711');
    if (foundRecord) {
      console.log('Found the reported number in the database:');
      console.log(`  Caller ID: ${foundRecord.CallerID}`);
      console.log(`  Company Code: ${foundRecord.CompanyCode}`);
      console.log(`  Area Code: ${foundRecord.AreaCode}`);
      console.log('');
      if (foundRecord.AreaCode === '954') {
        console.log('✅ SUCCESS: The Area Code is now correctly extracted as "954"!');
      } else {
        console.log(`❌ ISSUE: The Area Code is still showing "${foundRecord.AreaCode}" instead of "954"`);
      }
    } else {
      console.log('The specific number 949548010711 was not found in the first 100 outgoing records.');
      console.log('This might mean it\'s not in the recent data or needs a broader search.');
    }
    
    await service.close();
    
  } catch (error) {
    console.error('Error during test:', error);
    await service.close();
  }
}

testLiveAreaCode().catch(console.error);