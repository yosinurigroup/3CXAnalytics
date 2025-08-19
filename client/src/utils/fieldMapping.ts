/**
 * Field mapping utility for converting between user-facing display names
 * and MongoDB field names for incoming calls
 */

// User-facing display names (with spaces and proper capitalization)
// Also handles variations in capitalization from different CSV sources
export const DISPLAY_FIELDS = {
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
} as const;

// Reverse mapping: MongoDB field names to display names
export const MONGODB_TO_DISPLAY: Record<string, string> = Object.entries(DISPLAY_FIELDS).reduce(
  (acc, [display, mongodb]) => {
    acc[mongodb] = display;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Convert display field names to MongoDB field names
 * @param displayName - The user-facing field name (e.g., "Call Time")
 * @returns The MongoDB field name (e.g., "CallTime")
 */
export function displayToMongoDB(displayName: string): string {
  return DISPLAY_FIELDS[displayName as keyof typeof DISPLAY_FIELDS] || displayName;
}

/**
 * Convert MongoDB field names to display field names
 * @param mongoDBName - The MongoDB field name (e.g., "CallTime")
 * @returns The user-facing field name (e.g., "Call Time")
 */
export function mongoDBToDisplay(mongoDBName: string): string {
  return MONGODB_TO_DISPLAY[mongoDBName] || mongoDBName;
}

/**
 * Transform an object with display field names to MongoDB field names
 * @param displayObject - Object with display field names as keys
 * @returns Object with MongoDB field names as keys
 */
export function transformDisplayToMongoDB(displayObject: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(displayObject)) {
    const mongoDBKey = displayToMongoDB(key);
    transformed[mongoDBKey] = value;
  }
  
  return transformed;
}

/**
 * Transform an object with MongoDB field names to display field names
 * @param mongoDBObject - Object with MongoDB field names as keys
 * @returns Object with display field names as keys
 */
export function transformMongoDBToDisplay(mongoDBObject: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(mongoDBObject)) {
    const displayKey = mongoDBToDisplay(key);
    transformed[displayKey] = value;
  }
  
  return transformed;
}

/**
 * Transform an array of objects from display to MongoDB format
 */
export function transformArrayDisplayToMongoDB(displayArray: Record<string, any>[]): Record<string, any>[] {
  return displayArray.map(transformDisplayToMongoDB);
}

/**
 * Transform an array of objects from MongoDB to display format
 */
export function transformArrayMongoDBToDisplay(mongoDBArray: Record<string, any>[]): Record<string, any>[] {
  return mongoDBArray.map(transformMongoDBToDisplay);
}

/**
 * Get all display field names as an array
 */
export function getDisplayFieldNames(): string[] {
  return Object.keys(DISPLAY_FIELDS);
}

/**
 * Get all MongoDB field names as an array
 */
export function getMongoDBFieldNames(): string[] {
  return Object.values(DISPLAY_FIELDS);
}