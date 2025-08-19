/**
 * Field mapping utility for converting between user-facing display names
 * and MongoDB field names for incoming calls (CommonJS version for Node.js)
 */

// User-facing display names (with spaces and proper capitalization)
// Also handles variations in capitalization from different CSV sources
const DISPLAY_FIELDS = {
  'Call Time': 'CallTime',
  'Caller ID': 'CallerID',
  'Destination': 'Destination',
  'Trunk': 'Trunk',
  'Trunk Number': 'TrunkNumber',
  'Trunk number': 'TrunkNumber', // Handle lowercase variation
  'DID': 'DID',
  'Did': 'DID', // Handle mixed case variation
  'Status': 'Status',
  'Ringing': 'Ringing',
  'Talking': 'Talking',
  'Total Duration': 'TotalDuration',
  'Call Type': 'CallType',
  'Sentiment': 'Sentiment',
  'Summary': 'Summary',
  'Transcription': 'Transcription'
};

// Reverse mapping: MongoDB field names to display names
const MONGODB_TO_DISPLAY = Object.entries(DISPLAY_FIELDS).reduce(
  (acc, [display, mongodb]) => {
    acc[mongodb] = display;
    return acc;
  },
  {}
);

/**
 * Convert display field names to MongoDB field names
 * @param {string} displayName - The user-facing field name (e.g., "Call Time")
 * @returns {string} The MongoDB field name (e.g., "CallTime")
 */
function displayToMongoDB(displayName) {
  return DISPLAY_FIELDS[displayName] || displayName;
}

/**
 * Convert MongoDB field names to display field names
 * @param {string} mongoDBName - The MongoDB field name (e.g., "CallTime")
 * @returns {string} The user-facing field name (e.g., "Call Time")
 */
function mongoDBToDisplay(mongoDBName) {
  return MONGODB_TO_DISPLAY[mongoDBName] || mongoDBName;
}

/**
 * Transform an object with display field names to MongoDB field names
 * @param {Object} displayObject - Object with display field names as keys
 * @returns {Object} Object with MongoDB field names as keys
 */
function transformDisplayToMongoDB(displayObject) {
  const transformed = {};
  
  for (const [key, value] of Object.entries(displayObject)) {
    const mongoDBKey = displayToMongoDB(key);
    transformed[mongoDBKey] = value;
  }
  
  return transformed;
}

/**
 * Transform an object with MongoDB field names to display field names
 * @param {Object} mongoDBObject - Object with MongoDB field names as keys
 * @returns {Object} Object with display field names as keys
 */
function transformMongoDBToDisplay(mongoDBObject) {
  const transformed = {};
  
  for (const [key, value] of Object.entries(mongoDBObject)) {
    const displayKey = mongoDBToDisplay(key);
    transformed[displayKey] = value;
  }
  
  return transformed;
}

/**
 * Transform an array of objects from display to MongoDB format
 * @param {Array} displayArray - Array of objects with display field names
 * @returns {Array} Array of objects with MongoDB field names
 */
function transformArrayDisplayToMongoDB(displayArray) {
  return displayArray.map(transformDisplayToMongoDB);
}

/**
 * Transform an array of objects from MongoDB to display format
 * @param {Array} mongoDBArray - Array of objects with MongoDB field names
 * @returns {Array} Array of objects with display field names
 */
function transformArrayMongoDBToDisplay(mongoDBArray) {
  return mongoDBArray.map(transformMongoDBToDisplay);
}

/**
 * Get all display field names as an array
 * @returns {Array<string>} Array of display field names
 */
function getDisplayFieldNames() {
  return Object.keys(DISPLAY_FIELDS);
}

/**
 * Get all MongoDB field names as an array
 * @returns {Array<string>} Array of MongoDB field names
 */
function getMongoDBFieldNames() {
  return Object.values(DISPLAY_FIELDS);
}

module.exports = {
  DISPLAY_FIELDS,
  MONGODB_TO_DISPLAY,
  displayToMongoDB,
  mongoDBToDisplay,
  transformDisplayToMongoDB,
  transformMongoDBToDisplay,
  transformArrayDisplayToMongoDB,
  transformArrayMongoDBToDisplay,
  getDisplayFieldNames,
  getMongoDBFieldNames
};