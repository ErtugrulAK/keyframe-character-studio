/**
 * Sequential ID Generator
 * 
 * Generates clean, incrementing numeric IDs for parts, tracks, keyframes, and presets.
 * Format: prefix + sequential number (e.g., "part_1", "track_1", "kf_1", "pkf_x_1")
 * 
 * The counter persists across calls and ensures no ID collisions within a session.
 */

let globalCounter = 0;

/**
 * Generate a unique sequential ID with the given prefix.
 * @param prefix - The prefix for the ID (e.g., "part", "track", "kf", "pkf_x")
 * @returns A string like "part_1", "track_2", etc.
 */
export function generateId(prefix: string): string {
  globalCounter += 1;
  return `${prefix}_${globalCounter}`;
}

/**
 * Initialize the counter based on existing IDs in the project.
 * Call this at startup to avoid collisions with pre-existing data.
 * @param existingIds - Array of all existing IDs in the project
 */
export function initializeIdCounter(existingIds: string[]): void {
  let maxNum = 0;
  for (const id of existingIds) {
    // Extract the trailing number from IDs like "part_3", "track_12", "kf_5"
    const match = id.match(/_(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  globalCounter = maxNum;
}
