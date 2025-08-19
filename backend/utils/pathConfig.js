const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Path Configuration Utility
 * Automatically detects and configures upload paths for different laptops
 */

class PathConfig {
    constructor() {
        this.possiblePaths = [
            // Current laptop path (relative to current project)
            path.resolve(__dirname, '../uploads'),
            // Maddie's laptop path
            path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads"),
            // Alternative paths that might exist
            path.resolve(os.homedir(), 'Desktop/thesis-project/backend/uploads'),
            path.resolve(os.homedir(), 'Documents/thesis-project/backend/uploads'),
            path.resolve(os.homedir(), 'OneDrive/Desktop/thesis-project/backend/uploads'),
            // Additional possible paths
            path.resolve(os.homedir(), 'Desktop/THESIS PROJECT - copy/backend/uploads'),
            path.resolve(os.homedir(), 'Documents/THESIS PROJECT - copy/backend/uploads'),
            path.resolve(os.homedir(), 'OneDrive/Documents/THESIS PROJECT - copy/backend/uploads')
        ];
        
        this.uploadDirs = {
            resume: null,
            developer_profiles: null,
            properties: null,
            profile_pictures: null,
            projects: null
        };
        
        this.initializePaths();
    }

    /**
     * Initialize upload paths by finding the first accessible directory
     * or creating a new one in the current project
     */
    initializePaths() {
        let basePath = null;
        
        // Try to find an existing uploads directory
        for (const possiblePath of this.possiblePaths) {
            try {
                if (fs.existsSync(possiblePath)) {
                    // Test if we can read and write to this directory
                    if (this.isPathAccessible(possiblePath)) {
                        basePath = possiblePath;
                        console.log(`✅ Found accessible uploads directory: ${basePath}`);
                        break;
                    } else {
                        console.log(`⚠️  Found directory but no access: ${possiblePath}`);
                    }
                }
            } catch (error) {
                console.log(`⚠️  Cannot access path: ${possiblePath}`);
                continue;
            }
        }
        
        // If no existing directory found, use the current project's uploads directory
        if (!basePath) {
            basePath = path.resolve(__dirname, '../uploads');
            console.log(`📁 Using current project uploads directory: ${basePath}`);
        }
        
        // Set up all upload subdirectories
        this.uploadDirs.resume = path.join(basePath, 'resume');
        this.uploadDirs.developer_profiles = path.join(basePath, 'developer_profiles');
        this.uploadDirs.properties = path.join(basePath, 'properties');
        this.uploadDirs.profile_pictures = path.join(basePath, 'profile_pictures');
        this.uploadDirs.projects = path.join(basePath, 'projects');
        
        // Create directories if they don't exist
        this.createDirectories();
    }

    /**
     * Create all necessary upload directories
     */
    createDirectories() {
        Object.entries(this.uploadDirs).forEach(([key, dirPath]) => {
            try {
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                    console.log(`📁 Created directory: ${dirPath}`);
                }
            } catch (error) {
                console.error(`❌ Error creating directory ${dirPath}:`, error.message);
                // Try to create in current project directory as fallback
                try {
                    const fallbackPath = path.resolve(__dirname, `../uploads/${key}`);
                    fs.mkdirSync(fallbackPath, { recursive: true });
                    this.uploadDirs[key] = fallbackPath;
                    console.log(`🔄 Using fallback directory: ${fallbackPath}`);
                } catch (fallbackError) {
                    console.error(`❌ Failed to create fallback directory: ${fallbackError.message}`);
                }
            }
        });
    }

    /**
     * Get the path for a specific upload type
     * @param {string} type - The upload type (resume, developer_profiles, properties, etc.)
     * @returns {string} The absolute path for the upload directory
     */
    getUploadPath(type) {
        if (!this.uploadDirs[type]) {
            throw new Error(`Unknown upload type: ${type}`);
        }
        return this.uploadDirs[type];
    }

    /**
     * Get all upload paths
     * @returns {Object} Object containing all upload paths
     */
    getAllPaths() {
        return { ...this.uploadDirs };
    }

    /**
     * Get the base uploads directory
     * @returns {string} The base uploads directory path
     */
    getBasePath() {
        return path.dirname(this.uploadDirs.resume);
    }

    /**
     * Check if a path is accessible
     * @param {string} dirPath - The directory path to check
     * @returns {boolean} True if accessible, false otherwise
     */
    isPathAccessible(dirPath) {
        try {
            return fs.existsSync(dirPath) && 
                   fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.W_OK) === undefined;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the current working directory for debugging
     * @returns {string} Current working directory
     */
    getCurrentWorkingDir() {
        return process.cwd();
    }

    /**
     * Get the current user's home directory
     * @returns {string} User's home directory
     */
    getUserHomeDir() {
        return os.homedir();
    }

    /**
     * Log current path configuration
     */
    logConfiguration() {
        console.log('\n📋 Upload Path Configuration:');
        console.log('=============================');
        console.log(`🏠 Current Working Directory: ${this.getCurrentWorkingDir()}`);
        console.log(`👤 User Home Directory: ${this.getUserHomeDir()}`);
        console.log(`📁 Base Uploads Directory: ${this.getBasePath()}`);
        console.log('📂 Upload Subdirectories:');
        Object.entries(this.uploadDirs).forEach(([key, dirPath]) => {
            const accessible = this.isPathAccessible(dirPath);
            const status = accessible ? '✅' : '❌';
            console.log(`  ${status} ${key}: ${dirPath}`);
        });
        console.log('=============================\n');
    }
}

// Create and export a singleton instance
const pathConfig = new PathConfig();

// Log the configuration on startup
pathConfig.logConfiguration();

module.exports = pathConfig;
