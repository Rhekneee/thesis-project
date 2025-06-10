const ManufacturingModel = require("../model/manu.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for project image uploads
const projectUploadDir = path.resolve("C:/Users/Maddie/Documents/THESIS PROJECT - copy/uploads/projects");

// Ensure the upload directory exists
if (!fs.existsSync(projectUploadDir)) {
  fs.mkdirSync(projectUploadDir, { recursive: true });
}

const projectStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, projectUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'project-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const projectUpload = multer({
  storage: projectStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const ManufacturingController = {
  createProject: async (req, res) => {
    try {
      const {
        project_name,
        location,
        deadline,
        developer_id
      } = req.body;

      // Validate required fields
      if (!project_name || !location || !deadline || !developer_id) {
        return res.status(400).json({ 
          success: false,
          error: "All required fields must be filled" 
        });
      }

      let project_image = null;
      if (req.file) {
        project_image = req.file.filename;
      }

      // Insert project WITHOUT manufacturing_cost
      const projectId = await ManufacturingModel.storeProject({
        project_name,
        location,
        submission_date: new Date().toISOString().split('T')[0],
        deadline,
        status: 'pending',
        project_image,
        developer_id
      });

      res.status(201).json({ 
        success: true, 
        message: "Project submitted successfully",
        projectId 
      });

    } catch (error) {
      console.error("Error in project creation:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to create project" 
      });
    }
  },

  getAllProjects: async (req, res) => {
    try {
      const projects = await ManufacturingModel.getAllProjects();
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch projects" 
      });
    }
  },

  getProjectById: async (req, res) => {
    try {
      const projectId = req.params.id;
      const project = await ManufacturingModel.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ 
          success: false,
          error: "Project not found" 
        });
      }
      res.json({
        success: true,
        project
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch project" 
      });
    }
  },

  updateProject: async (req, res) => {
    try {
      const projectId = req.params.id;
      const {
        project_name,
        location,
        deadline,
        status,
        manufacturing_cost
      } = req.body;

      if (!project_name || !location || !deadline) {
        return res.status(400).json({ 
          success: false,
          error: "All required fields must be filled" 
        });
      }

      let project_image = null;
      if (req.file) {
        project_image = req.file.filename;
      }

      await ManufacturingModel.updateProject(projectId, {
        project_name,
        location,
        deadline,
        status: status || 'pending',
        project_image,
        manufacturing_cost: manufacturing_cost || null
      });

      res.json({ 
        success: true, 
        message: "Project updated successfully" 
      });
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update project" 
      });
    }
  },

  updateProjectStatus: async (req, res) => {
    try {
      const projectId = req.params.id;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ 
          success: false,
          error: "Status is required" 
        });
      }

      await ManufacturingModel.updateProjectStatus(projectId, status);
      res.json({ 
        success: true, 
        message: "Project status updated successfully" 
      });
    } catch (error) {
      console.error("Error updating project status:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update project status" 
      });
    }
  },

  updateManufacturingCost: async (req, res) => {
    try {
      const projectId = req.params.id;
      const { manufacturing_cost } = req.body;

      if (!manufacturing_cost || manufacturing_cost <= 0) {
        return res.status(400).json({ 
          success: false,
          error: "Valid manufacturing cost is required" 
        });
      }

      await ManufacturingModel.updateManufacturingCost(projectId, manufacturing_cost);
      res.json({ 
        success: true, 
        message: "Manufacturing cost updated successfully" 
      });
    } catch (error) {
      console.error("Error updating manufacturing cost:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to update manufacturing cost" 
      });
    }
  },

  getProjectsByDeveloper: async (req, res) => {
    try {
      const developerId = req.params.developerId;
      const projects = await ManufacturingModel.getProjectsByDeveloper(developerId);
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error("Error fetching developer projects:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch developer projects" 
      });
    }
  },

  getProjectsByStatus: async (req, res) => {
    try {
      const status = req.params.status;
      const projects = await ManufacturingModel.getProjectsByStatus(status);
      res.json({
        success: true,
        projects
      });
    } catch (error) {
      console.error("Error fetching projects by status:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch projects by status" 
      });
    }
  }
};

module.exports = { 
  ManufacturingController,
  projectUpload
};
