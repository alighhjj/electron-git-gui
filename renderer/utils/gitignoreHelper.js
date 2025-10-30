/**
 * Helper functions for handling .gitignore file operations
 */

/**
 * Checks and manages .gitignore file to ensure node_modules/ is included
 * @param {string} repoPath - Path to the repository
 * @returns {Promise<boolean>} - Whether the .gitignore was modified
 */
export const ensureNodeModulesInGitignore = async (repoPath) => {
  try {
    // Use the electronAPI to handle file operations in the main process
    if (window.electronAPI && window.electronAPI.ensureNodeModulesInGitignore) {
      const result = await window.electronAPI.ensureNodeModulesInGitignore(repoPath);
      // The main process returns an object like { success: true, modified: true/false }
      // We return the modified flag as a boolean
      return result && result.success && result.modified;
    } else {
      console.error('electronAPI not available or ensureNodeModulesInGitignore method not found');
      return false;
    }
  } catch (error) {
    console.error('Error handling .gitignore:', error);
    // We don't want to break the functionality if gitignore handling fails
    return false;
  }
};